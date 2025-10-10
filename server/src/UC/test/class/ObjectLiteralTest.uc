// Test for object literals, placed here, because,
// an object literal is a special symbol lookup that limits its search results by a class limitor.
class ObjectLiteralTest;

struct LiteralStruct {};

function ShouldBeValidObjectLiteralTest()
{
    local Class class;
    local Function function;
    local Field struct; // cant use 'Struct' due keyword context sensitivity.

    struct = Struct'ObjectLiteralTest.LiteralStruct';
    class = Class'Class'; // simple and basic
    class = Class'Core.Class'; // qualified with the package identifier.

    // Sanity check (yes it happens that Core.Class works just fine, but not for user-declared classes etc)
    class = Class'ObjectLiteralTest';
    class = Class'class.ObjectLiteralTest';

    function = Function'ShouldBeValidObjectLiteralTest';
    // FIXME: Not yet supported.
    // function = Function'ObjectLiteralTest.ShouldBeValidObjectLiteralTest';
    // function = Function'class.ObjectLiteralTest.ShouldBeValidObjectLiteralTest';

    struct = Struct'LiteralStruct';
    struct = Struct'ObjectLiteralTest.LiteralStruct';
    struct = Struct'class.ObjectLiteralTest.LiteralStruct';
}
