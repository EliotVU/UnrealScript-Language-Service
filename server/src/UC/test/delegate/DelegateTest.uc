class DelegateTest;

delegate bool Delegate();

function ShouldBeValidDelegateTest()
{
    local delegate<Delegate> delegateFunction;

    // Validate whether a delegate property call resolves to the delegate's return type, in this case 'Bool'
    if (delegateFunction()) {

    }

    // Validate whether a delegate function call resolves to the delegate's return type, in this case 'Bool'
    if (Delegate()) {

    }
}
