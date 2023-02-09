class Grammar;

const C1 = 0;

enum E1 {
    E1_1,
    E1_2,
};

struct S1 {
    struct S2 {
        var int V1;
    };

    var enum E2 {
        E2_1
    } V2;

    var int V3;
};

var int V4;

delegate D1();

function F1();

state ST1
{
    ignores F1;

    function F2();

begin:
    F2();
}

defaultproperties
{
    V4=1
}