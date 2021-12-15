class AssignTypeTest extends Object;

const READONLY_FIELD = '';

struct myVector {
    var int x;
};

var myVector vectorVar;

var int property;
var int dimVar[2];
var const int constVar;
var name nameVar;

function int AssignTest() {
    local AssignTypeTest obj;
    local array<AssignTypeTest> objs;
    local myVector v;

    // VALID
    property = 0;
    property = AssignTest();
    obj = self;
    dimVar[0] = 0;
    objs[0] = self;
    v = vectorVar;
    nameVar = 'NameLiteral';

    // Not typechecked yet
    // INVALID
    property = 'NameLiteral';
    obj = 0;
    dimVar = 0;
    nameVar = "NameAsString";

    // INVALID
    READONLY_FIELD = 'NameLiteral';
    constVar = 0;
    AssignTest = AssignTest;
    AssignTest() = 0;
    self = self;
    0 = 0;
    'NameLiteral' = 'NameLiteral';
    "StringLiteral" = "StringLiteral";
    sqdqsd = 0;
    AssignTypeTest = none;
    class'AssignTypeTest' = self.class;
}

defaultproperties
{
    nameVar="NameAsString"
    nameVar=NameAsString
    nameVar=none

    vectorVar=(x=0)
    vectorVar={(
		x=0,
		y=0,
	)}

    // INVALID
    nameVar='NameAsString'
    READONLY_FIELD=0
    myVector=0
    AssignTest=0
    0=0
}
