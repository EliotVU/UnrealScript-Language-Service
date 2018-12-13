//=============================================================================
// Object: The base class all objects.
// This is a built-in Unreal class and it shouldn't be modified.
//=============================================================================
class test extends Object
    dependson(Object)
	noexport;

/**
	HELLO
 */
var struct NotReplicatable {
    var() string Name;
} InlineStruct;

// ALREADY EXISTS?
var(CategoryName) string Extends;

var() bool bSimulateGravity;
var() bool bIsCrouched, test;

var Sound ObjectReference;

var array<int> IntArray;
var array<Sound> ObjectArray;
var array<class<Object> > ClassArray;
var array<struct structWithinArray {
    var string Name;
}> StructArray;

replication
{
	reliable if( bNetDirty && (Role==ROLE_Authority) )
        test, Name, NotReplicatable, bSimulateGravity, bIsCrouched, bIsWalking;

	reliable if( Role<ROLE_Authority )
		ServerChangedWeapon, NextItem, ServerNoTranslocator;
}

function NextItem();

function CodeMethod()
{
    local int Integer;

    test = NextItem;
}