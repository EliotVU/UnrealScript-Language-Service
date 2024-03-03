// This class serves the purpose to test the overloading of operators.
class OverloadingTest extends Overloads;

function ShouldOverload()
{
    local int intOne;
    local float floatOne;
    local StructOne structOne;
    local StructTwo structTwo;
    local EnumOne enumOne;

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
}

function InvalidOverload()
{
    local StructOne structOne;
    local StructTwo structTwo;

    structOne + structTwo;
    structTwo + structOne;
}
