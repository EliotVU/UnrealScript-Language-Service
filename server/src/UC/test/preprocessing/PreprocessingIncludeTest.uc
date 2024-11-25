class PreprocessingIncludeTest native;

`include(preprocessing\PreprocessingInclude.uci)

var `funcType varBool;

// Validate if the function 'IncludedFunction' is indeed declared as it should be when the include macro is expanded.
function `funcType ShouldBeValidTest()
{
    // FIXME: Not working when used in a local decl.
    local `funcType localBool;

    localBool = `funcName ();

    return localBool;
}
