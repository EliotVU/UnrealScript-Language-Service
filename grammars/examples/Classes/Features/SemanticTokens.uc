class SemanticTokens;

const constField = nameof(class'Core.Object'.default.EAxis.AXIS_X);

enum ETest {
    MyEnumMember
};

struct sTest {

};

var ETest enumProperty;
var sTest structProperty;
var Class classProperty;
var InterfaceTest interfaceProperty;
var delegate<Test> delegateProperty;
var array<Test> arrayProperty;
var name nameProperty;

const DIM_SIZE = 5;
var int dimProperty[DIM_SIZE];
// var int dimProperty2[ETest.MyEnumMember];

function Test(int param1)
{
    local Class obj;
    local Package pkg;
    local int local1;
    local Array<Class> objects;
    local name name;

    name = '';
    name = 'MyName';
    name = name("MyName");
    name = nameof(name);

    myName:

    local1 = param1;
    obj = Class(self);
    obj = Class(default.Outer);
    switch (0) {
        case MyEnumMember:
            break;
        case ETest.MyEnumMember:
            break;
        default:
            break;
    }

    myName2:

    goto name;
    goto myName;
    goto myName2;


    pkg = package'Core';
    obj = class'Core.Class';

    objects.AddItem(self);
}


defaultproperties {
    nameProperty=MyName
    enumProperty=MyEnumMember

    begin object class=Object name=Subobject1
	end object
}