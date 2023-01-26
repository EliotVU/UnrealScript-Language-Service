// Test an ambiguous issue where a call looks like either a class casting or a function of the same name.
class CastingTest;

event Created()
{
    // Should cast to the class
    CastingTest(Outer);
    // Should reference the function
    CastingTest("Message", 0);
    CastingTest("Message");
}

function CastingTest(string message, optional int index);