class AssignTypeTest extends Object
    native;

const NAME_CONSTANT = '';
const STRING_CONSTANT = "";
const BYTE_CONSTANT = 0;

enum EEnum {
    E_NONE,
    E_2,
};

var EEnum enumVar;

struct sVector {
    var int x;
};

var sVector vectorVar;

var int property;
// FIXME: Qualified enum access
var int dimVar[EEnum.EnumCount];
var int dimVar[EEnum];
var int dimVar[2];
var const int constVar;
var name nameVar;

var native int nativeVar;
var transient int transientVar;

function int AssignTest() {
    local AssignTypeTest obj;
    local array<AssignTypeTest> objs;
    local sVector v;

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
    NAME_CONSTANT = 'NameLiteral';
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

    // FIXME: Type error
    getName(enum'EEnum', enumVar);
}

function name getName(Object obj, byte index);

defaultproperties
{
    enumVar=E_NONE

    vectorVar=(x=0)
    vectorVar={(
		x=0,
		y=0,
	)}

    nameVar="NameAsString"
    nameVar=STRING_CONSTANT // FIXME: Is this allowed?
    nameVar=NameAsString
    nameVar=NAME_CONSTANT
    nameVar=none

    // WARNING
    nativeVar=0xFF
    transientVar=0xFF

    // INVALID
    nameVar=BYTE_CONSTANT
    nameVar='NameAsString'
    NAME_CONSTANT=0
    sVector=0
    AssignTest=0
    0=0
}
