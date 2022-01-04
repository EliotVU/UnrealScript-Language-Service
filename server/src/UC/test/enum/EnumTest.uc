class EnumTest;

enum EEnumTest {
    ET_None,
    ET_Other
};

var EEnumTest MyEnumProperty;

var EEnumTest MyEnumBasedDimProperty[EEnumTest];
    // FIXME
// var EEnumTest MyQualifiedEnumBasedDimProperty[EEnumTest.EnumCount];

function EEnumTest EnumTestMethod(EEnumTest p1 = ET_None, EEnumTest p2 = EEnumTest.ET_None) {
    p1 = EEnumTest.EnumCount;
    p2 = ET_None;
    p2 = ET_Other;
    switch (p1) {
        case EEnumTest.EnumCount:
        case ET_None:
        case ET_Other:
    }
    return ET_None;

    Enum'EEnumTest';
}

defaultproperties
{
    MyEnumProperty=ET_None
    MyEnumBasedDimProperty(ET_None)=ET_None
    // TODO: Check if this is allowed
    // MyEnumBasedDimProperty(EEnumTest.ET_None)=ET_None
    // FIXME
    // MyEnumProperty=EEnumTest.ET_None
}