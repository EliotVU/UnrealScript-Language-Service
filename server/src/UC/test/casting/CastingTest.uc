// Test an ambiguous issue where a call looks like either a class casting or a function of the same name.
class CastingTest dependson(InterfaceTest);

struct Vector {};
struct Rotator {};
struct Range {};

enum CastingTest { CT_Tag };
var enum EEnum { E_1 } EnumProperty;
var InterfaceTest InterfaceProperty;

delegate DelegateFunction();

// Verify that we can match a function over a package of the same name.
function int Core(Object other);

// Verify that we can distinguish a function call from a class casting of the same name, depending on the context and arguments.
function int CastingTest(string message, optional int index);

function CastingTest ShouldCastToClass()
{
    // Should resolve to class 'CastingTest'
    return CastingTest(self);
}

function InterfaceTest ShouldCastToInterface()
{
    // Should resolve to interface 'InterfaceTest'
    return InterfaceTest(self);
}

function CastingTest ShouldCastFromInterface()
{
    local InterfaceTest other;

    // Should resolve to class 'CastingTest'
    return CastingTest(other);
}

function CastingTest.CastingTest ShouldCastToEnum()
{
    local byte b;
    
    // Should resolve to enum 'CastingTest'
    return CastingTest(b);
}

function int ShouldCallFunction()
{
    local int i;

    // Should resolve to function 'CastingTest'
    i = CastingTest("Message", 0);
    i = CastingTest("Message");

    // Should resolve to function 'Core', unless Core as a class does exist.
    return Core(self);
}

function InvalidCastingTest()
{
    // Invalid non-zero cost conversions:

    Name(false);

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

function ValidCastingTest()
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
    CastingTest(self);
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

function InvalidDynamicCastingInSwitchStatementTest()
{
    switch (CastingTest(self)) { default: break; }
    switch (InterfaceTest(self)) { default: break; }
    switch (CastingTest(DelegateFunction)) { default: break; }
    switch (string(self)) { default: break; }
}

function string SwitchString(string s);
function ValidTypesInSwitchStatementTest()
{
    switch (SwitchString("")) { default: break; }
}
