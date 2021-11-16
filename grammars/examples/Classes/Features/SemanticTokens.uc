class SemanticTokens extends Core.Object;

const constProperty = nameof(class'Object'.default.EAxis.AXIS_X);

enum ETest {
    MyEnumMember
};

struct sTest {

};

var ETest enumProperty;
var sTest structProperty;
var Object classProperty;
var InterfaceTest interfaceProperty;
 
function Test(int param1)
{
    local Object obj;
    local Package pkg;
    local int local1;

    local1 = param1;
    obj = Object(self);
    obj = Object(default.Outer);
    switch (0) {
        case MyEnumMember:
            break;
        case ETest.MyEnumMember:
            break;
        case EAxis.AXIS_X:
            break;
    }

    pkg = package'Core'; 
    class'Core.Object';  
}


defaultproperties {
    enumProperty=MyEnumMember
}