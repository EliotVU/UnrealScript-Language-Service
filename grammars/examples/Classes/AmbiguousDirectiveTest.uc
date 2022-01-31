/**
 * UnrealScript allows '#' as an operator declaration, which is ambiguous with the compiler directive #
 * This means that
 */
class AmbiguousDirectiveTest;

event created()
{
    local bool b;

    // Working as expected
    #error;

    // Working as expected
    b = #true;

    // The parser picks up the preoperator as the better match,
    // this should not be the case, besides this is not even a valid expression.
    #b = #true;
}

static final preoperator bool #(bool a)
{
    return a;
}