class AssignTypeTest extends Object;

const READONLY_FIELD = '';

struct myVector {
    var int x;
};

var myVector vectorProperty;

var int property;
var int dimProperty[2];
var const int constProperty;

function int AssignTest() {
    local AssignTypeTest obj;
    local array<AssignTypeTest> objs;
    local myVector v;

    // VALID
    property = 0;
    property = AssignTest();
    obj = self;
    dimProperty[0] = 0;
    objs[0] = self;
    v = vectorProperty;

    // TODO: INVALID
    property = '';
    obj = 0;
    dimProperty = 0;

    // INVALID
    READONLY_FIELD = '';
    constProperty = 0;
    AssignTest = AssignTest;
    AssignTest() = 0;
    self = self;
    0 = 0;
    '' = '';
    "" = "";
    sqdqsd = 0;
    AssignTypeTest = none;
    class'AssignTypeTest' = self.class;
}

defaultproperties
{
    vectorProperty=(x=0)

    // INVALID
    READONLY_FIELD=0
    myVector=0
    AssignTest=0
    0=0
}
