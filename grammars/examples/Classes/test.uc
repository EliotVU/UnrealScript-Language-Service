class Test extends Core.Object
	native;

const CONST_SIZEOF 					= sizeof(Object);
const CONST_CLASS 					= class'Object';
const CONST_VECT 					= vect(0,0,0);
const CONST_ROT 					= rot(0,0,0);
const CONST_RNG 					= rng(0,0);
const CONST_STRING					= "string";
const CONST_NAME 					= 'name';
const CONST_NUMBER					= 4e+2;
const CONST_LEADING_NUMBER			= +004;
const CONST_HEXDECIMAL				= -0x04;
const CONST_FLOAT1					= 0.f;
const CONST_FLOAT2					= +0.fe-2f;
const CONST_FLOAT3					= 0f;
const CONST_BOOL					= true;
// Test that 0 is not seen as a "falsy" value.
const CONST_INT1                    = 0;
const CONST_INT2                    = 1;

// To test enum and constant values usage in defaultproperties.
const DEFAULT_CONST	= 0;
enum EDefault {
	D_Zero,
	D_One
};

enum AEnum {
	A_1,
	A_2
};

struct native transient AStruct {
	struct StubStruct {
		struct DeepStruct {
			enum EDeep {

			};
		};
	};

	var array<struct ASubStruct extends StubStruct {
		var DeepStruct DeepStructRef;

		// Invalid, can only deep reference using a Class identifier!
		// var DeepStruct.EDeep DeepEnumRef;

		// FIXME: Self-reference should be disallowed.
		var ASubStruct SubInt;
	}> InlinedSubArray;

	// var DeepStruct DeepStructRef; // Should not be able to find DeepStruct from here.

	// FIXME: Cannot find ASubStruct, this worked in the most recent released version!
	var array<ASubStruct> SubArray;

	var Color AColor;
	var Guid AGuid;
	var Vector AVector;
	var Plane APlane;
	var Matrix AMatrix;

	structcpptext
	{
		(){}

		FAStruct() {

		}
	}
};

var int defaultInt;
var float defaultFloat;
var byte defaultByte;
var bool defaultBool;
var name defaultName;
var string defaultStr;
// Not supported a.t.m
// var string[255] defaultString;
var button defaultButton;
var Object defaultObject;
var Class defaultClass;
var pointer defaultPointer; // struct in UC3+

var int 					defaultIntArray[CONST_NUMBER]; const CONST_ARRAYCOUNT = arraycount(defaultIntArray);
var array<int> 				defaultIntDynamicArray;

// TODO: Test how the UC compiler handles delegate names that are ambigues with a class.
// As it currently stands, the delegate is matched with class "Test" instead of function "Test".
var delegate<Test> 			defaultDelegate;

// FIXME: Breaks variable highlighting.
var map{string, float} 		defaultStringToFloatMap;
var class<Test> 			defaultClassMeta[4];
var array<class<Test> > 	defaultArrayOfClasses;
var Test					defaultTestRef;

// Test for non-quoted tooltip
var array<Object> MetaData<Tooltip = tooltip for my array. | test=0>;
var array<Object> MetaData1<Tooltip = tooltip for my array.>;
var array<Object> MetaData2<Tooltip = >;
var array<Object> MetaData3<Tooltip>;
var array<Object> MetaData4<>;

// var array<bool> IllegalBoolArray;
// var array<array<Test> > IllegalBoolArray;
// var bool IllegalBool[4];
// var array<bool> IllegalBool[4];

// Fancy native stuff.
var private{public} native int NativeInt[2], NativeIntTwo[2]{INT};

// Test for multiple categories.
// FIXME: Multicategories are breaking variable highlighting.
var(Category1, Category2) config(Test) string Description;

var int superVar;

native function string const() const;

static final preoperator string $(string A) {
	return "$" $ A;
}

static final postoperator string PrependDollar(string A) {
	return "$" $ A;
}

static final preoperator int &(string A) {
	return int(A);
}

static final preoperator int ToInt(string A) {
	return int(A);
}

function coerce Object Spawn( class<Object> class, Object owner ) {
	return class;
}

function Class Load(name objName, class ObjClass) {
	// Test class coercing
    Spawn( class'Test', self ).const();
	return objClass;
}

// FIXME: Should be disallowed
function struct e {} InlinedStructReturnType() {
	local e s;
	return s;
}

function TestQualifiedStruct( Test.AStruct struct ) {
	class'Engine';
	class'Engine.Engine';
	package'Engine';
}

function string returnAssignment(){
	// Test an assignment within a return statement.
	local string str;

	if ((str $= 2) == "2") {

	}
	return str $= 5;
}

function AddObj(Object obj) {
	return;
}

delegate byte Test() {

	local int i;

	local Object obj;
	local class<Test> objClass;
	local string str;

	// FIXME: Local structs or enums are disallowed!
	local array<struct e {}> eStruct;

	str = str $ $str;

	// FIXME: Preoperators with custom identifiers are not yet supported.
	i = 0;
	i = int(0.f);
	i = 256;
	// i = &str;
	// i = ToInt"test\s";
	// i = ToInt str;

	str = $"Test";
	// str = "Test"PrependDollar;
	// str = str PrependDollar;
	// str = PrependDollar "str";

	// Statement tests
	if (str == "") str = " "; else ; ;

	assert (str != "");

	do {
		str = "";
	} until (str == "")

	switch (str) {
		case "x":
		case "":
			// test for a "default" missmatch
			str = default.CONST_STRING;
			obj = default; // semantically invalid
			obj = const == none ? none : none;
			// case = default;
			break;

		default:
			break;
	}

	loop:
	for (i = 0; i < Len(str); ++i) {
		continue;
		break;
	}

	if (false) {
		// goto loop;
	} else if (true) {
		;
	}

	// FIXME: AddObj is parsed as preoperator!
	foreach AllObjects(class'Object', obj)
		AddObj(obj);

    // Test accessable properties via an object literal.
	// str = StrProperty'str'.default.Name;

	obj = new class'Test';

	// Is this valid UC?
	// obj = new obj != none ? class'Test' : class'Test';
	obj = new (none) (obj != none ? class'Test' : class'Test')(none);

	objClass = class<Test>(DynamicLoadObject("Path", class'Class'));
	i = i - -i;
	i = 2.0 * int(0.1 + float(i)*0.225,0.2,1.0);

	// Type resolving tests!
	inputInt(defaultIntArray[0]);
	InputObject(defaultClassMeta[0]);
	InputObject(defaultArrayOfClasses[0]);
	InputObject(GetObjects()[0]);
	InputArray(GetObjects());

	return byte((i+1.f)*128.f);
	return (float(i)/128.f)-1.f;
}

function InputInt(int i) {

}

function InputObject(Object obj) {

}

function InputArray(Array<Object> objs) {
	local int l;
	local Object obj;
	local Class objClass;

	objs.AddItem(self);
	objs.AddItem("self");
	objs.RemoveItem(self);
	obj = objs.Find(self);

	l = objs.Length;
	objClass = obj.Class;
}

function Array<Object> GetObjects() {
}

function TestFunction();

// test missing expressions
function byte TestInvalidCode(){
	// Missing expression test!
	// if ( < 0 ) {

	// }

	// if ( 0 > ) {

	// }
}

defaultproperties
{
	defaultIntDynamicArray(DEFAULT_CONST)=1
	defaultIntDynamicArray(D_Zero)=1
	defaultIntDynamicArray(D_One)=1

	defaultIntDynamicArray.Add(1)
	defaultIntDynamicArray.Remove(1)
	defaultIntDynamicArray.RemoveIndex(0)
	defaultIntDynamicArray.Replace(0, 1)
	defaultIntDynamicArray.Empty

	defaultInt=1024				|defaultFloat=1.0f			|defaultByte=1
	defaultBool=true			|defaultBool=false
	defaultName=CONST_NAME		|defaultName=MyName
	defaultStr=CONST_STRING		|defaultStr="string"

	superVar=0

	begin object class=Test name=Test0
		superVar=0
	end object
	defaultTestRef=Test0
}