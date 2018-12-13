//=============================================================================
// Object: The base class all objects.
// This is a built-in Unreal class and it shouldn't be modified.
//=============================================================================
class test extends Object
    dependson(Object)
	noexport;

const TEST_CONSTANT = 10;

struct TopStruct {

};

enum ETopEnum {
    TE_Value1
};

/**
	HELLO
 */
var struct NotReplicatable {
    var() string Name;
} InlineStruct;

var array<struct structWithinArray {
    var string Name;
}> InlinedStructArray;

var Engine.Actor DeepReference;
var array<class<Engine.Actor>> DeepActorClassArray;
var array<Object.Vector> DeepVectorArray;

var Sound ObjectProperty;
var array<int> ArrayProperty;
var map<Actor> MapProperty;
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
        ObjectProperty, thisDoesntExist, NotReplicatable;

	reliable if( Role<ROLE_Authority )
		ReplicatedFunction;
}

function ReplicatedFunction();

function CodeMethod()
{
    local int Integer;

    test = NextItem();
}