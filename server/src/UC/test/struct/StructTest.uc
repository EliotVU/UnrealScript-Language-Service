class StructTest;

struct Vector 
{
    var float X, Y, Z;
};

static final operator(16) Vector * (float A, Vector B);
static final operator(16) Vector * (Vector A, float B);

function TypeOperatorsTest()
{
    local Vector vector;

    // intrinsics
    vector = vector;
    vector = vect(1, 1, 0);
    
    // operators
    vector = 1.0 * vect(1, 1, 0);
    vector = vect(1, 1, 0) * 1.0;
}