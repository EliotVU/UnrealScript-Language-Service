class DelegateTest;

delegate bool DelegateFunction();

function ShouldBeValidDelegateTest()
{
    local delegate<DelegateFunction> delegateFunction;

    // Validate whether a delegate call resolves to the delegate's return type, in this case 'Bool'
    if (delegateFunction()) {

    }
}
