class StructTest;

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
