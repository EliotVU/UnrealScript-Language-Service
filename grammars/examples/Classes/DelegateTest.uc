class DelegateTest;

var delegate<OnDelegate> DelegateProperty;
var delegate<OnDelegate2> Delegate2Property;
var delegate<OnDelegate3> Delegate3Property;
var delegate<DelegateTest.OnDelegate> QualifiedDelegateProperty;
var const delegate<DelegateTest.OnDelegate> ConstDelegateProperty;

// @EXPECT ERROR
var delegate<AcceptDelegate> InvalidProperty;

delegate OnDelegate(name param1, bool param2);
delegate OnDelegate2(name param1, bool param2);
delegate bool OnDelegate3(name param1, bool param2);

function AcceptDelegate(delegate<OnDelegate> delegate);

function delegate<OnDelegate> GetDelegate();

function OnAcceptCompatible(name param1, bool param2)
{
    ;
}

function OnAcceptIncompatible(name param1, name param2, name param3)
{
    ;
}

function bool Test(name param1, bool param2)
{
    local DelegateTest object;

    AcceptDelegate(none);
    AcceptDelegate(OnDelegate);
    AcceptDelegate(GetDelegate());
    AcceptDelegate(DelegateProperty);
    AcceptDelegate(Delegate2Property);
    AcceptDelegate(OnAcceptCompatible);
    // @EXPECT ERROR
    AcceptDelegate(Delegate3Property);
    AcceptDelegate(OnAcceptIncompatible);
    AcceptDelegate(Test);
    AcceptDelegate(true);
    AcceptDelegate('');
    AcceptDelegate("");
    AcceptDelegate(0);
    AcceptDelegate(self);
    AcceptDelegate(class'DelegateTest');

    DelegateProperty = none;
    DelegateProperty = OnDelegate;
    DelegateProperty = GetDelegate();
    DelegateProperty = OnAcceptCompatible;
    // @EXPECT ERROR
    DelegateProperty = OnAcceptIncompatible;
    // @EXPECT ERROR
    ConstDelegateProperty = OnAcceptCompatible;
    // @EXPECT ERROR
    AcceptDelegate(GetDelegate);

    OnDelegate = OnAcceptCompatible;
    // @EXPECT ERROR
    OnDelegate = OnAcceptIncompatible;

    // @EXPECT ERROR
    DelegateProperty = Test;
    DelegateProperty = true;
    DelegateProperty = '';
    DelegateProperty = "";
    DelegateProperty = 0;
    DelegateProperty = self;
    DelegateProperty = class'DelegateTest';
    // Not sure what the compiler thinks of this...
    DelegateProperty = DelegateProperty'examples.DelegateTest.DelegateProperty';

    // @EXPECT ERROR
    OnAcceptCompatible = DelegateProperty;
    object = self;
}

defaultproperties
{
    DelegateProperty=OnAcceptCompatible
    OnDelegate=OnAcceptCompatible

    // @EXPECT ERROR
    DelegateProperty=Test
    DelegateProperty=true
    DelegateProperty=''
    DelegateProperty=""
    DelegateProperty=0
    DelegateProperty=self
    DelegateProperty=class'DelegateTest'
}