// This class serves the purpose to test the overloading of operators.
class OverloadingTest extends Overloads;

function ShouldOverload()
{
    local int intOne;
    local float floatOne;
    local StructOne structOne;
    local StructTwo structTwo;
    local EnumOne enumOne;
    local Class classOne, classTwo;

    true == true;

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
    enumOne == EO_1;

    // Should pick Overloads.==(Object,Object)
    classOne == classTwo;

    // Should pick Overloads.+(StructOne,StructOne)
    structOne = (structOne += 1.0);
    floatOne = (1.0 += structOne);
}

function ShouldBeInvalidOverload()
{
    local StructOne structOne;
    local StructTwo structTwo;

    // FIXME: Diagnostic for missmatching overloads, (not added yet because we have false positives)
    // structOne + structTwo;
    // structTwo + structOne;
}

function ShouldBeInvalidOperator()
{
    // ! '~=' is not defined in Overloads.uc
    "" ~= "";

    // ! 'dot' is not defined in Overloads.uc
    vect(0,0,0) dot vect(0,0,0);
}
