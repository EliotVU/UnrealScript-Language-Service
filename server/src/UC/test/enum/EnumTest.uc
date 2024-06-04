class EnumTest extends Core.Object;

enum EEnumTest
{
    ET_None,
    ET_Other
};

var EEnumTest MyEnumProperty;

/*UC3*/
var EEnumTest MyEnumBasedDimProperty[EEnumTest];

// FIXME
// var EEnumTest MyQualifiedEnumBasedDimProperty[EEnumTest.EnumCount];

var array<EEnumTest> MyEnumArrayProperty;

function EnumObjectTest(Enum object);
function EnumObjectTest2(Object object);
function EnumByteTest(int b);
function EnumIntTest(int i);

private function EEnumTest EnumHintTest(EEnumTest p1 = ET_MAX)
{
    return p1;
}

/* Test all kind of situations where we need a byte/int hint to resolve an identifier to an enum tag. */
function EEnumTest ShouldHintEnumTest()
{
    local EEnumTest p1;
    local byte b1;

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
    if (EnumHintTest(0) != ET_Other) {
        return 0;
    }

    // in literals
    EnumObjectTest(Enum'EEnumTest');
    EnumObjectTest2(Enum'EEnumTest');

    // in arguments
    EnumHintTest(p1);
    EnumHintTest(ET_Other);
    EnumHintTest(0);
    EnumHintTest(byte(0));

    // coerce
    EnumIntTest(p1); // as a byte
    EnumByteTest(EEnumTest.EnumCount);
    EnumIntTest(ET_Other);

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
    MyEnumProperty=ET_None
    MyEnumBasedDimProperty(ET_None)=ET_None
    // TODO: Check if this is allowed
    // MyEnumBasedDimProperty(EEnumTest.ET_None)=ET_None
    // FIXME
    // MyEnumProperty=EEnumTest.ET_None

    // Verify that the enum hint is picked up.
    MyEnumArrayProperty.Add(ET_None)
}
