//=============================================================================
// test.
//
// TEST DESC
//
//=============================================================================
class test extends Core.Object;

// var(MultiComponent, Advanced) protectedwrite editinline editfixedsize array<FComponent> Components<MaxPropertyDepth=1>;

#exec obj load file="test\UT2003Fonts.utx"
#exec obj load file="test\MenuSounds.uax"
#exec obj load file="test\ClientBTimes.utx" package="ClientBTimesV7b"
#exec obj load file="test\CountryFlagsUT2K4.utx" package="ClientBTimesV7b" group="CountryFlags"

const TEST_CONSTANT = 10;

var int staticArray[4];

const CONST_CLASS = class'Object';
const CONST_VECT = vect(0,0,0);
const CONST_ROT = rot(0,0,0);
const CONST_RNG = rng(0,0);
const CONST_SIZEOF = sizeof(Object);
const CONST_ARRAYCOUNT = arraycount(staticArray);
const CONST_NAMEOF = nameof(staticArray);

enum ETopEnum {
    TE_Value1
};

struct TopStruct {

};

/**
	HELLO
 */
var struct NotReplicatable {

} InlineStruct;

var array<struct structWithinArray {
    var() string Name;

    struct ChildStruct {
        var string Name;
    }

    var() string AnotherName;
    var() array<string> Names;
}> InlinedStructArray;

var public Actor.ENetRole DeepEnumRef;
var public Actor.ENetRole DeepStructRef;
var protected array<class<Actor> > ActorClassArray;
var private array<Object.Vector> VectorStructArray;

var const Sound objectProperty;
var array<int> arrayProperty;
// FIXME: not parsable yet
// var map{string, class Actor} mapProperty;
var float floatProperty;
var int intProperty;
var bool boolProperty;
var byte byteProperty;
var pointer pointerProperty;
var string stringProperty;
var name nameProperty;
var class classProperty;
var class<Actor> classGenericProperty;
var int sizedProperty[10];
var int constSizedProperty[TEST_CONSTANT];
var int MultiLineVar1[2], MultiLineVar2<UIMin=5|UIMax=10>;

var(CategoryName) string CategoryProperty;

var public const int ModifiedProperty;
var Actor.ENetRole Role;

// Ambigious test
function replication();

replication
{
	reliable if( boolProperty && (Role==ROLE_Authority) )
        objectProperty, thisDoesntExist, notReplicatable;

	reliable if( Role<ROLE_Authority )
		ReplicatedFunction;
}

native(121) static final operator(24) bool >= ( string A, string B );
native(122) static final preoperator Color # ( string A );

event ReplicatedFunction();

static function CodeMethod();

function TestForEach()
{
    local Object obj;

    foreach self.AllObjects(class'Object', obj)
    {
        if (obj.Name == 'Test') {
            continue;
        }
        break;
    }
}

function int TestReturn()
{
    return ++ 1;
}

function TestAssignment()
{
    const topGlobalConst = 1;

    local class<Actor> myClass;

    local Color C;
    local int exec;

    myClass = class<Actor>(DynamicLoadObject("path", class'Class'));

    exec = !0xFFFFFFFF;
    C = #exec;

    // Should be an error: "const variables cannot be modified!"
    class'Actor'.default.Name = 'Test';

    // Replication is not a class, but test ambigious case with replication block.
    replication'TestObject'.Name = 'Test';

    const globalConst = topGlobalConst;
}

static function TestNew()
{
    local Object obj;

    obj = new(, "test") default.Class;
    obj = new(, "test") default.Class (default);
}

function string Param(float float1, float float2)
{
    local string s;
    local vector v;
    local array<string> ss;
    local Object obj;

    v = (vect(4,4,4) Dot vect(0,0,0));

    self.static.CodeMethod();

    obj = default;
    default = obj;

    static.CodeMethod();

    ss.Length = globalConst + topGlobalConst;
    ss[0] = "test";

    myLabel:
    s = "Test" @ C;
    if (s == "") {
        goto myLabel;
    }
    return s;
}

defaultproperties
{
    CategoryProperty="Defaults"

    begin object name=Obj1
        ObjectFlags=0xFF
    end object

    begin object class=Object name=Obj1
        ObjectFlags=0xFF
    end object

    begin object name=Obj1 class=Object
        ObjectFlags=0xFF
    end object

    InlineStruct=()
    InlineStruct=(Names=("Name","Name2"))
}