class SemanticTokens extends Core.Object;

const constField = nameof(class'Object'.default.EAxis.AXIS_X);

enum ETest {
    MyEnumMember
};

struct sTest {

};

var ETest enumProperty;
var sTest structProperty;
var Object classProperty;
var InterfaceTest interfaceProperty;
var delegate<Test> delegateProperty;
var array<Test> arrayProperty;
var name nameProperty;

const DIM_SIZE = 5;
var int dimProperty[DIM_SIZE];
// var int dimProperty2[ETest.MyEnumMember];

function Test(int param1)
{
    local Object obj;
    local Package pkg;
    local int local1;
    local Array<Object> objects;
    local name name;

    name = '';
    name = 'MyName';
    name = nameof(name);

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

    objects.AddItem(self);
}

defaultproperties {
    nameProperty=MyName
    enumProperty=MyEnumMember

    begin object class=Object name=Subobject1
	end object
}