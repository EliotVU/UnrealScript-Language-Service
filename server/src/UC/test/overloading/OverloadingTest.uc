// This class serves the purpose to test the overloading of operators.
class OverloadingTest extends Overloads;

function ShouldOverloadTest()
{
    local byte byteOne;
    local int intOne;
    local float floatOne;
    local StructOne structOne;
    local StructTwo structTwo;
    local EnumOne enumOne;
    local Class classOne, classTwo;
    local Object objectOne;
    local Interface interfaceOne;
    local OverloadingInterfaceTest interfaceTwo;

    true == true;

    // Should pick Overloads.+(Int,Int), cast to byte should work if the int operator was picked.
    byte(1 + 1);

    // Should pick Overloads.+(Int,Int), cast to float should work if the int operator was picked.
    float(1 + 1);

    // Should pick Overloads.+(Float,Float), cast to int should work if the float operator was picked.
    int(1.0 + 1.0);

    // Should pick Overloads.+(Float,Float)
    int(1 + 1.0);

    // Should pick Overloads.+(StructOne,StructOne)
    structOne + structOne;

    // Should pick Overloads.+(structTwo,structTwo)
    structTwo + structTwo;

    // Should pick Overloads.==(Int,Int)
    enumOne == EO_1; // by global tag
    enumOne == EnumOne.EO_1; // by context tag
    enumOne == EnumOne.EnumCount; // by intrinsic tag
    enumOne == enumOne; // by variable

    // Should pick Overloads.==(Object,Object)
    classOne == classTwo;
    classOne == none;
    objectOne == none;
    interfaceOne == none; // Yes interface == none should not match the interface operator.

    // Should pick Overloads.==(Interface,Interface)
    interfaceTwo == none;

    // Should pick Overloads.+=(StructOne,Float)
    structOne = (structOne += 1.0);
    // Also test implicit casting from int to float.
    structOne = (structOne += 1);
    // Should pick Overloads.+=(Float,StructOne)
    floatOne = (1.0 += structOne);

    ++byteOne;
    ++intOne;

    // Should pick Overloads.*=(Byte,Byte)
    float(byte(1) *= byte(1));
    // Should pick Overloads.*=(Int,Float)
    float(1 *= 1.0);
    // Should pick Overloads.*=(Float,Float)
    int(1.0 *= 1.0);
    // Should pick Overloads.*=(Int,Float)
    float(1 *= 1); // with implicit casting

    self $ "string";
    "string" $ self;
    "string" $ "string";
    "string" $ EnumOne;
}

function ShouldBeInvalidOverloadTest()
{
    local StructOne structOne;
    local StructTwo structTwo;
    local float floatOne;

    local int dimensionedLocal[2];

    // FIXME: Diagnostic for mismatching overloads, (not added yet because we have false positives)
    // structOne + structTwo;
    // structTwo + structOne;

    // Can be cast to int but the compiler will find two matches of the same "best cost" and thus report an incompatible type error.
    ++floatOne;

    none $ "string";

    ++ dimensionedLocal;

    // Cannot pass 'Int' to an 'Float' marked as 'Out'
    floatOne = (1 += structOne);
}

function ShouldBeInvalidOperatorTest()
{
    // ! '~=' is not defined in Overloads.uc
    "" ~= "";

    // ! 'dot' is not defined in Overloads.uc
    vect(0,0,0) dot vect(0,0,0);
}
