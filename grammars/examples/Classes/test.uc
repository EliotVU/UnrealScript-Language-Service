class Test extends Object;

var int defaultInt;
var float defaultFloat;

var int defaultIntArray[4];

const CONST_SIZEOF 			= sizeof(Object);
const CONST_ARRAYCOUNT 		= arraycount(defaultIntArray);
const CONST_OBJECT_CLASS 	= class'Object';
const CONST_VECT 			= vect(0,0,0);
const CONST_ROT 			= rot(0,0,0);
const CONST_RNG 			= rng(0,0);

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

function Class Load(name objName, class ObjClass) {
	return objClass;
}

function byte Test() {
	local int i;

	local Test obj;
	local class<Test> objClass;
	local string str;

	str = str $ $str;

	i = 0;
	i = int(0.f);
	i = 256;
	i = &str;
	i = ToInt"test";
	i = ToInt str;

	str = $"Test";
	str = "Test"PrependDollar;
	str = str PrependDollar;
	str = PrependDollar "str";
	obj = new class'Test';

	// Is this valid UC?
	// obj = new obj != none ? class'Test' : class'Test';
	obj = new (none) (obj != none ? class'Test' : class'Test')(none);

	objClass = class<Test>(DynamicLoadObject("Path", class'Class'));
	i = i - -i;
	i = 2.0 * int(0.1 + float(i)*0.225,0.2,1.0);

	return byte((i+1.f)*128.f);
	return (float(i)/128.f)-1.f;
}

function TestFunction();

// test missing expressions
function byte TestInvalidCode(){
	// Missing expression test!
	if ( < 0 ) {

	}

	if ( 0 > ) {

	}
}

defaultproperties
{
	defaultInt=1|defaultFloat=1.0f
}