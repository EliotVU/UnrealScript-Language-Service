class DelegateTest;

var delegate<OnDelegate> DelegateProperty;
var delegate<OnDelegate2> Delegate2Property;

var delegate<OnDelegate3> Delegate3Property;
var delegate<DelegateTest.OnDelegate> QualifiedDelegateProperty;
var const delegate<DelegateTest.OnDelegate> ConstDelegateProperty;

var DelegateProperty DelegatePropertyRef;

// @EXPECT ERROR
var delegate<InternalAcceptDelegate> InvalidProperty;

delegate OnDelegate(name param1, bool param2);
delegate OnDelegate2(name param1, bool param2);
delegate bool OnDelegate3(name param1, bool param2);

function InternalAcceptDelegate(delegate<OnDelegate> delegate);

function delegate<OnDelegate> GetDelegate() {
    return DelegateProperty;
}

function InternalOnAcceptCompatible(name param1, bool param2)
{
    ;
}

function InternalOnAcceptIncompatible(name param1, name param2, name param3)
{
    ;
}

function bool Test(name param1, bool param2)
{
    local DelegateTest object;

    InternalAcceptDelegate(none);
    InternalAcceptDelegate(OnDelegate);
    InternalAcceptDelegate(GetDelegate());
    InternalAcceptDelegate(DelegateProperty);
    InternalAcceptDelegate(Delegate2Property);
    InternalAcceptDelegate(InternalOnAcceptCompatible);
    InternalAcceptDelegate(OnDelegate != none ? GetDelegate() : OnDelegate);

    // @EXPECT ERROR
    InternalAcceptDelegate(Delegate3Property);
    InternalAcceptDelegate(InternalOnAcceptIncompatible);
    InternalAcceptDelegate(Test);
    InternalAcceptDelegate(true);
    InternalAcceptDelegate('');
    InternalAcceptDelegate("");
    InternalAcceptDelegate(0);
    InternalAcceptDelegate(self);
    InternalAcceptDelegate(class'DelegateTest');

    DelegateProperty = none;
    DelegateProperty = OnDelegate;
    DelegateProperty = OnDelegate != none ? GetDelegate() : OnDelegate;
    DelegateProperty = InternalOnAcceptCompatible;

    // @EXPECT ERROR
    DelegateProperty = InternalOnAcceptIncompatible;

    // @EXPECT ERROR
    ConstDelegateProperty = InternalOnAcceptCompatible;

    // @EXPECT ERROR
    InternalAcceptDelegate(GetDelegate);

    OnDelegate = InternalOnAcceptCompatible;

    // @EXPECT ERROR
    OnDelegate = InternalOnAcceptIncompatible;

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
    DelegatePropertyRef = DelegateProperty'examples.DelegateTest.DelegatePropertyRef';

    // @EXPECT ERROR
    InternalOnAcceptCompatible = DelegateProperty;
}

defaultproperties
{
    DelegateProperty=InternalOnAcceptCompatible
    DelegateProperty=none
    OnDelegate=InternalOnAcceptCompatible
    OnDelegate=none

    // @EXPECT ERROR
    DelegateProperty=Test
    OnDelegate=InternalOnAcceptIncompatible
    DelegateProperty=true
    // DelegateProperty=''
    DelegateProperty=""
    DelegateProperty=0
    DelegateProperty=self
    DelegateProperty=class'DelegateTest'

    begin object class=ArchetypeTest name=archetype
        MyDelegate=InternalOnAcceptCompatible
    end object

}