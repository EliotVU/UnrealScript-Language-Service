class MyExtendedWithinClassTest extends MyWithinClass;

function bool ShouldBeValidOuterTest()
{
    // Validate that we can access bMyBoolean from the outer class (in the parent class)
    return Outer.bMyBoolean;
}

function name ShouldBeValidOuterNameTest()
{
    local MyBaseClass Test;

    // Validate that we can access name from the outer class without a 'within' definition.
    return Test.Outer.Name;
}

function Class<MyExtendedWithinClassTest> ShouldBeValidClassTest()
{
    // Validate that 'Class' is coerced to 'MyExtendedWithinClassTest'
    return Class;
}

function MyExtendedWithinClassTest ShouldBeInvalidClassTest()
{
    // Validate that 'Class' is not compatible with the return's type when coerced.
    // Should be a typemismatch
    return Class;
}
