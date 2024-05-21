// Test an ambiguous issue where a call looks like either a class casting or a function of the same name.
class CastingTest extends Object dependson(InterfaceTest) implements (InterfaceTest);

struct Vector {};
struct Rotator {};
struct Range {};

enum CastingTest { CT_Tag };
var private enum EEnum { E_1 } EnumProperty;
var private InterfaceTest InterfaceProperty;

var array< Class<CastingTest> > TestClasses;

private delegate DelegateFunction();

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

    // Should resolve to function 'Core', unless Core as a class does exist.
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
    string(self);

    // from name
    bool('None');
    string('None');

    // from delegate
    string(DelegateFunction);

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
}

function ShouldBeValidAssignmentTest()
{
    local CastingTest c;
    local Object obj;
    local CastingTest cc[2];
    local array<CastingTest> ca;
    local InterfaceTest other;

    // FIXME: (c) is picked up as a cast instead of a template reference
    // Ensure it doesn't mistake this for a cast from `other` to `self.Class`
    c = new (self) self.Class (other);

    c = new (none) Class'CastingTest';
    c = new (none) Class'CastingDerivative';
    obj = Class'Object';

    cc[0] = c;
    cc[0] = new (none) Class'CastingDerivative';

    ca[0] = c;
    ca[0] = new (none) Class'CastingDerivative';
}

function ShouldBeInvalidAssignmentTest()
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

function ShouldBeValidClassArgumentTest()
{
    local Class<CastingTest> cls;
    local CastingTest c;
    local Object obj;

    // By limitor
    AcceptClassLimitor(Class'CastingTest');
    AcceptClassLimitor(Class'CastingDerivative');
    AcceptClassLimitor(Class<CastingDerivative>(cls));
    AcceptClassLimitor(Class<CastingDerivative>(c));
    AcceptClassLimitor(cls);
    AcceptClassLimitor(c);

    // Any class
    AcceptClass(Class'CastingTest');
    AcceptClass(Class'CastingDerivative');
    AcceptClass(Class'Class');
    AcceptClass(c);
    AcceptClass(cls);
}

function ShouldBeInvalidClassArgumentTest()
{
    local Class<Object> cls;
    local CastingDerivative c;
    local Object obj;

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
}
