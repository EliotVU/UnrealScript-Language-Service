// Test an ambiguous issue where a call looks like either a class casting or a function of the same name.
class CastingTest extends Core.Object
    dependson (InterfaceTest, CastingActor)
    implements (InterfaceTest);

struct Vector {};
struct Rotator {};
struct Range {};

enum CastingTest { CT_Tag };
var private enum EEnum { E_1 } EnumProperty;
var private InterfaceTest InterfaceProperty;

var array< Class<CastingTest> > TestClasses;

var struct CastingTestStruct {
    var Class<CastingTest> TestClass;
} CastingTestStruct;

var Actor Actor;
var Class<CastingActor> ActorClass;

var bool bBoolProperty;
var const Array<int> ConstIntArrayProperty;
var Array<int> IntArrayProperty;
var Array<string> StringArrayProperty;
var const int ConstIntProperty;
var delegate<DelegateMethod> DelegateProperty;

private delegate DelegateMethod();
private function DelegateTarget();

// Verify that we can match a function over a package of the same name.
private function int Core(int other);

// Verify that we can distinguish a function call from a class casting of the same name, depending on the context and arguments.
private function int CastingTest(string message, optional int index);

function CastingTest ShouldCastToClassTest()
{
    // Should resolve to class 'CastingTest'
    return CastingDerivative(self);
}

function InterfaceTest ShouldCastToInterfaceTest()
{
    // Should resolve to interface 'InterfaceTest'
    return InterfaceTest(self);
}

function CastingTest ShouldCastFromInterfaceTest()
{
    local InterfaceTest other;

    // Should resolve to class 'CastingTest'
    return CastingTest(other);
}

function CastingTest.CastingTest ShouldCastToEnumTest()
{
    local byte b;

    // Should resolve to enum 'CastingTest'
    return CastingTest(b);
}

function int ShouldCallFunctionTest()
{
    local int i;

    // Should resolve to function 'CastingTest'
    i = CastingTest("Message", 0);
    i = CastingTest("Message");

    // Should resolve to function 'Core'
    return Core(0);
}

function ShouldBeInvalidCastingTest()
{
    // Invalid non-zero cost conversions:

    name(false);

    // from enum
    // float(EEnum.E_1);

    // Zero cost conversions:

    string("");
    byte(byte(0)); // 0 is an int internally, so ensure we are trying to cast a byte to byte by double casting.
    int(0xFFFFFFFF);
    float(0.0f);
    bool(false);
    // FIXME: No struct reference when acquiring type-kind
    // Vector(vect(0,0,0));
}

private function Object ObjectCastFunction();

function ShouldBeValidCastingTest()
{
    // from byte
    int(byte(0));
    bool(byte(0));
    float(byte(0));
    string(byte(0));

    // from enum
    byte(EnumProperty);
    int(EnumProperty);
    string(EnumProperty);

    // from int
    byte(0);
    bool(0);
    float(0);
    string(0);

    // from bool
    byte(false);
    int(false);
    float(false);
    string(false);

    // from float
    byte(0.0f);
    int(0.0f);
    bool(0.0f);
    string(0.0f);

    // from object
    bool(self);
    CastingDerivative(self);
    InterfaceTest(self);
    CastingDerivative(ObjectCastFunction());
    string(self);

    // from name
    bool('None');
    string('None');

    // from delegate
    string(DelegateMethod);

    // from interface
    bool(InterfaceProperty);
    string(InterfaceProperty);

    // from range? some branches have intrinsic support for the Range struct.

    // from vector
    bool(vect(0,0,0));
    Rotator(vect(0,0,0));
    string(vect(0,0,0));

    // from rotator
    bool(rot(0,0,0));
    Vector(rot(0,0,0));
    string(rot(0,0,0));

    // from string
    byte("0");
    EEnum("0");
    int("1");
    bool("1");
    float("1.0");
    // name("1.0"); // Only in a T3D context
    Vector("");
    Rotator("");

    // UC3
    Name("");
}

private function CoerceToString(coerce string s);
function ShouldBeValidCoerceTest()
{
    // Object to String
    CoerceToString(self);
    CoerceToString(byte(0));
    CoerceToString(0);
    CoerceToString(0.0);
    CoerceToString(true);
}

private function OutInt(out int i);
private function OutEnum(out EEnum e);
private function OutObject(out Object obj);
private function OutDerivedObject(out CastingTest obj);
private function OutArray(out array<string> arr);

function ShouldBeValidOutTest()
{
    local int i;
    local CastingTest obj;
    local array<string> arr;

    OutInt(i);

    OutEnum(EnumProperty); // by property

    OutObject(obj);
    OutDerivedObject(obj);

    OutArray(arr);
}

// Auto-Conversion should be disallowed for 'Out' types.
function ShouldBeInvalidOutTest()
{
    local byte b;
    local float f;

    // <===> Passing 'ReadOnly' types to 'Out' types are disallowed.
    OutInt(0);
    OutInt(0.0);
    OutInt(byte(0.0)); // no byte literal exists, as 0 will always be an 'Int' type.
    OutInt(ConstIntProperty);
    OutInt(EnumProperty); // TODO: Is this actually allowed?

    OutEnum(E_1);
    OutEnum(EEnum.E_1);
    OutEnum(EEnum.EnumCount);

    // Special keywords
    OutObject(self);
    OutObject(none);

    OutObject(Class'Object');

    // </===>

    // <===> Passing generalized types to 'Out' types are disallowed i.e. 'Float' to 'Int'
    OutInt(f);
    OutInt(b);

    // Compatible interface, but should be disallowed when passing to an 'Out' parameter.
    OutObject(InterfaceProperty);
    // </===>
}


function ShouldBeValidAssignmentTest()
{
    local byte b;
    local float f;
    local int i;

    b = 0;      // implicit cast from int to byte

    f = 0;      // implicit cast from int to float
    f = 0.0;

    i = 0;
    i = 0.0;    // implicit cast from float to int

    DelegateProperty = none;
    DelegateMethod = none;

    DelegateProperty = DelegateMethod;
    DelegateMethod = DelegateProperty;

    // from an ordinary non-delegate function
    DelegateProperty = DelegateTarget;
    DelegateMethod = DelegateTarget;
}

function ShouldBeInvalidAssignmentTest()
{
    local int i;

    i = none;

    self = none;

    0 = none;
    none = none;

    Class'Object' = none;
    vect(0,0,0) = vect(0,0,0);
}

// 'Out' params cannot accept 'Const' types, but it should be possible to re-assign nonetheless.
function ShouldBeValidOutAssignmentTest(out string s, out int i)
{
    s = "";
    i = 0;
}

// Maybe move to array tests
function ShouldBeValidArrayAssignmentTest()
{
    local Array<int> ints;
    local int multiInt[2];

    ints[0] = 0;
    multiInt[0] = 0;

    ints = ints;
    multiInt = multiInt;

    ConstIntArrayProperty[0] = 0;
}

function ShouldBeInvalidArrayAssignmentTest()
{
    local int multiInt[2], otherMultiInt[3];

    // ! mismatch array dimension
    multiint = otherMultiInt;

    // ! Cannot assign to 'Const'
    ConstIntArrayProperty = IntArrayProperty;

    // TODO: ! incompatible type
    // IntArrayProperty = StringArrayProperty;
}

// Valid return types

function byte ShouldBeValidReturnConstIntToByteTest() { return 0; }
function float ShouldBeValidReturnConstIntToFloatTest() { return 0; }
function int ShouldBeValidReturnConstFloatToIntTest() { return 0.0; }
function Object ShouldBeValidReturnNoneToObjectTest() { return none; }
function bool ShouldBeValidReturnConstBoolTest() { return true; }
function bool ShouldBeValidReturnBoolPropertyTest() { return bBoolProperty; }
function CastingTest ShouldBeValidReturnInterfaceCastToObjectTest() { return CastingTest(InterfaceProperty); }
function CastingTest ShouldBeValidReturnInterfacePropertyToObjectTest() { return InterfaceProperty; }

// Invalid return types

// Never generalize int to bool
function bool ShouldBeInvalidReturnConstIntToBoolTest() { return 0; }
function bool ShouldBeInvalidReturnNoneToBoolTest() { return none; }

function ShouldBeValidObjectAssignmentTest()
{
    local CastingTest c;
    local Object obj;
    local CastingTest cc[2];
    local array<CastingTest> ca;
    local InterfaceTest other;
    local CastingActor castingActor;

    local Class<CastingTest> metaClass;

    c = none;
    other = none;
    metaClass = none;

    // FIXME: `self.Class (other)` is picked up as a cast instead of a template reference
    // Ensure it doesn't mistake this for a cast from `other` to `self.Class`
    c = new (self) self.Class (obj);
    // as evident by passing an interface as an argument to 'Template'
    // c = new (self) self.Class (other);

    c = new (none) Class'CastingTest';
    c = new (none) Class'CastingDerivative';
    obj = Class'Object';

    cc[0] = c;
    cc[0] = new (none) Class'CastingDerivative';

    ca[0] = c;
    ca[0] = new (none) Class'CastingDerivative';

    // Test array (class) element assignment
    TestClasses[0] = Class'CastingTest';
    TestClasses[0] = Class'CastingDerivative';

    // Expect CastingActor to be compatible with local `castingActor`
    castingActor = Actor.Spawn(Class'CastingActor');
    castingActor = Actor.Spawn(ActorClass);

    // Expect `Data` to exist.
    Actor.Spawn(Class'CastingActor').Data;
}

function ShouldBeInvalidObjectAssignmentTest()
{
    local CastingDerivative c;

    // Not a derivative of CastingDerivative
    c = new (none) Class'CastingTest';

    // Test assignment of a class to an object reference (that is a class)
    c = Class'CastingTest';
    c = Class'CastingDerivative';
}

function ShouldBeInvalidDynamicCastingInSwitchStatementTest()
{
    local Object obj;

    switch (CastingTest(obj)) { default: break; }
    switch (InterfaceTest(obj)) { default: break; }
    // FIXME: Figure this one out, how do we cast a delegate to an object?
    // switch (CastingTest(DelegateFunction)) { default: break; }
    switch (string(obj)) { default: break; }
}

private function string SwitchString(string s);
function ShouldBeValidTypesInSwitchStatementTest()
{
    switch (SwitchString("")) { default: break; }
}

// === Test the implicit casting between a class, a derivative, or a metaclass.

private function AcceptClass(Class cls);
private function AcceptClassLimitor(Class<CastingTest> cls);
private function AcceptObject(Object obj);

function ShouldBeValidClassArgumentTest()
{
    local Class<CastingTest> cls;
    local CastingTest c;
    local Object obj;

    // By limitor
    AcceptClassLimitor(none);
    AcceptClassLimitor(Class'CastingTest');
    AcceptClassLimitor(Class'CastingDerivative');
    AcceptClassLimitor(Class<CastingDerivative>(cls));
    AcceptClassLimitor(Class<CastingDerivative>(c));
    AcceptClassLimitor(cls);
    AcceptClassLimitor(c);

    // Any class
    AcceptClass(none);
    AcceptClass(Class'CastingTest');
    AcceptClass(Class'CastingDerivative');
    AcceptClass(Class'Class');
    AcceptClass(c);
    AcceptClass(cls);

    // Any object
    AcceptObject(none);
    AcceptObject(self); // coerced type
    AcceptObject(self.Class); // coerced type
    AcceptObject(Class'Class');
}

function ShouldBeInvalidClassArgumentTest()
{
    local Class<Object> cls;
    local CastingDerivative c;
    local Object obj;

    // FIXME: Not producing any problems
    AcceptClassLimitor(Class'Class');
    // Invalid derivative
    AcceptClassLimitor(Class<Object>(cls));
    AcceptClassLimitor(Class<Object>(obj));
    AcceptClassLimitor(cls);
    // Should not allow an object to be passed to a class limitor
    AcceptClassLimitor(obj);
}

defaultproperties
{
    TestClasses.Add(Class'CastingTest')
    TestClasses.Add(Class'CastingDerivative')

    TestClasses(0)=Class'CastingTest'
    TestClasses(1)=Class'CastingDerivative'

    CastingTestStruct=(TestClass=Class'CastingTest')
}
