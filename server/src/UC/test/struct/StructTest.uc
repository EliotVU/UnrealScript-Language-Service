class StructTest extends Core.Object;

struct Vector
{
    var float X, Y, Z;
};

struct Plane extends Vector
{
    var float W;
};

struct Matrix
{
    var Plane XPlane;
    var Plane YPlane;
    var Plane ZPlane;
    var Plane WPlane;
};

struct Custom
{
    struct InnerStruct {  };

    var InnerStruct Inner;
};

struct MyOperatorlessStruct { };
struct MyOperatorlessStruct2 { };

static final operator(16) Vector * (float A, Vector B);
static final operator(16) Vector * (Vector A, float B);

function ShouldBeValidStructTest()
{
    local Vector vector;
    local Plane plane;

    // intrinsics
    vector = vector;
    vector.X = 0;
    vector = vect(1, 1, 0);

    // operators
    vector = 1.0 * vect(1, 1, 0);
    vector = vect(1, 1, 0) * 1.0;

    plane.X = 0;
    plane.W = 0;

    // FIXME: Not yet dealt with
    // vector = plane;
    // plane = vector;
}

function ShouldBeValidOperatorTest()
{
    // No overloads for structs unless explicitly defined.
    local MyOperatorlessStruct o1, o2;

    // operator '==' for this struct type does not exist, so use the built-in intrinsic struct comparison operators (only for '==' and '!=')
    if (o1 == o2);
    if (o1 != o2);
}

function ShouldBeInvalidOperatorTest()
{
    // No overloads for structs unless explicitly defined.
    local MyOperatorlessStruct o1;
    local MyOperatorlessStruct2 o2;

    if (o1 == o2);
    if (o1 != o2);
}
