class EnumTest
    extends Core.Object
    within Enum.EnumWithinClass
    dependson (EnumDependencyClass);

enum EEnumTest
{
    ET_None,
    ET_Other,
    ET_3
};

const EnumCountConstTest = 2;

var EEnumTest MyEnumPropertyTest;

// Test ArrayDim by constant.
var EEnumTest
    MyConstBasedDimPropertyTest[EnumCountConstTest],
    MyConstBasedDimPropertyTest2[EnumCountConstTest];

// Test ArrayDim by enum tag.
var EEnumTest MyEnumTagBasedDimPropertyTest[EEnumTest.ET_3];
var EEnumWithinTest MyWithinEnumTagBasedDimPropertyTest[EEnumWithinTest.EWT_3];
var EEnumDependencyTest MyDependencyEnumTagBasedDimPropertyTest[EEnumDependencyTest.EDT_3];
// TODO: Invalid tests
//!! var EEnumTest MyEnumTagBasedDimPropertyTest[EEnumTest.ET_Other];
// Test ArrayDim by intrinsic enum tag.
var EEnumTest MyEnumCountBasedDimPropertyTest[EEnumTest.EnumCount];

// UC3 Test ArrayDim by enum.
var EEnumTest MyEnumBasedDimPropertyTest[EEnumTest];

// Test Array of enum.
var array<EEnumTest> MyEnumArrayPropertyTest;

struct ParentStructTest
{
    // In UnrealScript we cannot explicitally declare an enum in a struct, unless we inline it! :)
    var enum EEnum2Test {
        ET2_None,
        ET2_Other,
        ET2_3
    } MyEnum;
};

struct EnumUsageInStructTest extends ParentStructTest
{
    // Test ArrayDim by constant.
    var EEnumTest MyConstBasedDimPropertyTest[EnumCountConstTest];

    // Test ArrayDim by enum tag.
    var EEnumTest MyEnumTagBasedDimPropertyTest[EEnumTest.ET_3];
    var EEnumWithinTest MyWithinEnumTagBasedDimPropertyTest[EEnumWithinTest.EWT_3];
    var EEnumDependencyTest MyDependencyEnumTagBasedDimPropertyTest[EEnumDependencyTest.EDT_3];
    // Test ArrayDim by intrinsic enum tag.
    var EEnumTest MyEnumCountBasedDimPropertyTest[EEnumTest.EnumCount];

    // UC3 Test ArrayDim by enum.
    var EEnumTest MyEnumBasedDimPropertyTest[EEnumTest];

    // Test Array of enum.
    var array<EEnumTest> MyEnumArrayPropertyTest;

    // inheritance tests...
    const EnumCountConst2Test = 2;

    var EEnumTest MyConstBasedDimProperty2Test[EnumCountConst2Test];
    var EEnumTest MyEnumTagBasedDimPropertyTest[EEnumTest.ET_3];

    // Should pickup the inherited enum.
    var EEnum2Test MyParentEnumTagBasedDimPropertyTest[EEnum2Test.ET2_3];

    var EEnum2Test MyParentEnumBasedDimPropertyTest[EEnum2Test];
};

function AcceptEnumObject(Enum object);
function AcceptObject(Object object);
function AcceptByte(int b);
function AcceptInt(int i);

private function EEnumTest EnumHintTest(EEnumTest p1 = ET_MAX)
{
    return p1;
}

/* Test all kind of situations where we need a byte/int hint to resolve an identifier to an enum tag. */
function EEnumTest ShouldHintEnumTest()
{
    local EEnumTest p1;
    local byte b1;
    local array<string> strings;

    // in assignments
    p1 = EEnumTest.EnumCount;
    p1 = EEnumTest.ET_None;
    p1 = ET_Other;
    p1 = 0;
    p1 = byte(0);
    p1 = EnumHintTest(p1);
    b1 = p1;
    b1 = EnumHintTest(p1);

    // in switch cases
    switch (p1) {
        case EEnumTest.EnumCount: return ET_Other;
        case EEnumTest.ET_None:
        case ET_Other:
        case 0:
        case byte(0): break;
    }

    // in binary operators
    // FIXME: This only occurs in this test (not in a workspace)
    // -- "Type 'Enum' and 'Byte' are incompatible with operator '!='"
    //!! if (b1 != ET_Other);
    //!! if (p1 != ET_Other);
    //!! if (EnumHintTest(0) != ET_Other);

    // in literals
    AcceptEnumObject(Enum'EEnumTest');
    AcceptObject(Enum'EEnumTest');

    // in arguments
    EnumHintTest(p1);
    EnumHintTest(ET_Other);
    EnumHintTest(0);
    EnumHintTest(byte(0));

    // coerce
    AcceptInt(p1); // as a byte
    AcceptByte(EEnumTest.EnumCount);
    AcceptInt(ET_Other);

    // in element accesses (UC3+)
    MyEnumArrayPropertyTest[ET_Other] = ET_Other;
    strings[ET_Other] = ""; // Hint is also expected for a non-int type array.

    // in returns
    return ET_Max;
}

function EEnumTest ShouldHintConditionalTest(bool bOther)
{
    return bOther == true
        ? ET_Other
        : ET_None;
}

defaultproperties
{
    MyEnumPropertyTest=ET_None
    MyEnumBasedDimPropertyTest(ET_None)=ET_None
    // TODO: Check if this is allowed
    // MyEnumBasedDimProperty(EEnumTest.ET_None)=ET_None
    // ! FIXME
    // MyEnumProperty=EEnumTest.ET_None

    // Verify that the enum hint is picked up.
    MyEnumArrayPropertyTest.Add(ET_None)
}
