class DelegateTest extends Core.Object;

struct DelegateStruct {
	var delegate<OnCompatibleDelegate> Callback;
};

var delegate<OnCompatibleDelegate>                      CompatibleDelegateProperty;
var delegate<OnIncompatibleDelegateByReturnType>        IncompatibleDelegateProperty;
var delegate<DelegateTest.OnCompatibleDelegate>         QualifiedDelegateProperty;

var DelegateProperty                                    DelegatePropertyRef;

private
function bool   InternalOnAcceptCompatible              (name param1, bool param2);
delegate bool   OnCompatibleDelegate                    (name param1, bool param2);

delegate int    OnIncompatibleDelegateByReturnType      (name param1, bool param2);
delegate bool   OnIncompatibleDelegateByParamsLength    (name param1, bool param2, bool param3);
delegate bool   OnIncompatibleDelegateByParamsType      (name param1, int  param2);


private function InternalAcceptDelegate(delegate<OnCompatibleDelegate> delegate);

function ShouldBeValidDelegateTest()
{
    if (CompatibleDelegateProperty('', false));
    if (OnCompatibleDelegate('', false));

    if (CompatibleDelegateProperty == none);
    if (OnCompatibleDelegate == none);

    InternalAcceptDelegate(OnCompatibleDelegate);
    InternalAcceptDelegate(CompatibleDelegateProperty);
    InternalAcceptDelegate(InternalOnAcceptCompatible);
    InternalAcceptDelegate(none);

    DelegatePropertyRef = DelegateProperty'DelegatePropertyRef';

    CompatibleDelegateProperty = QualifiedDelegateProperty;
    CompatibleDelegateProperty = OnCompatibleDelegate;
    CompatibleDelegateProperty = InternalOnAcceptCompatible;

    OnCompatibleDelegate = CompatibleDelegateProperty;
    OnCompatibleDelegate = InternalOnAcceptCompatible;
}

function ShouldBeInvalidDelegateTest()
{
    InternalAcceptDelegate(OnIncompatibleDelegateByReturnType);
    InternalAcceptDelegate(OnIncompatibleDelegateByParamsLength);
    InternalAcceptDelegate(OnIncompatibleDelegateByParamsType);
    InternalAcceptDelegate(IncompatibleDelegateProperty);

    CompatibleDelegateProperty = IncompatibleDelegateProperty;
}

defaultproperties
{
    CompatibleDelegateProperty=InternalOnAcceptCompatible
    CompatibleDelegateProperty=none

    OnCompatibleDelegate=InternalOnAcceptCompatible
    OnCompatibleDelegate=none
}
