//=============================================================================
// Object: The base class all objects.
// This is a built-in Unreal class and it shouldn't be modified.
//=============================================================================
class test extends Object
    dependson(Object)
	noexport;

const TEST_CONSTANT = 10;

enum ETopEnum {
    TE_Value1
};

struct TopStruct {

};

/**
	HELLO
 */
var struct NotReplicatable {
    var() string Name;

    struct ChildStruct {
        var string Name;
    }

    var() string AnotherName;
} InlineStruct;

var array<struct structWithinArray {
    var string Name;
}> InlinedStructArray;

var public Engine.Actor DeepReference;
var protected array<class<Engine.Actor> > DeepActorClassArray;
var private array<Object.Vector> DeepVectorArray;

var const Sound objectProperty;
var array<int> arrayProperty;
var map<Actor> mapProperty;
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
var int MultiLineVar1[2], MultiLineVar2;

var(CategoryName) string CategoryProperty;

var public const int ModifiedProperty;

replication
{
	reliable if( bNetDirty && (Role==ROLE_Authority) )
        objectProperty, thisDoesntExist, notReplicatable;

	reliable if( Role<ROLE_Authority )
		ReplicatedFunction;
}

native(121) static final operator(24) bool >= ( string A, string B );

function ReplicatedFunction();

simulated event CodeMethod()
{
    local int Integer;
    local Object obj;

    test = NextItem(, Integer,, test);
    obj = new(, "test") class'Object';
}

function int Param(float float1, float float2)
{
    // Should be an error: "const variables cannot be modified!"
    class'Actor'.default.Name = 'Test';
    return float1;
}

defaultproperties
{
    CategoryProperty="Defaults"
}