// Operator overloads to help with the testing of finding the correct overloaded operator even if that involves more complicated overloading types such as a struct.
class Overloads;

enum EnumOne {
    EO_1
};

struct StructOne {};
struct StructTwo {};

static final preoperator  byte          ++  (out byte A);
static final preoperator  int           ++  (out int A);

static final postoperator byte          ++  (out byte A);
static final postoperator int           ++  (out int A);

static final operator(24) bool          ==  (bool A, bool B);
static final operator(24) bool          ==  (int A, int B);
static final operator(24) bool          ==  (float A, float B);

static final operator(24) bool          ==  (Object A, Object B);
static final operator(26) bool          !=  (Object A, Object B);

static final operator(24) bool          ==  (Interface A, Interface B);
static final operator(26) bool          !=  (Interface A, Interface B);

static final operator(20) int           +   (int A, int B);
static final operator(20) float         +   (float A, float B);
static final operator(20) StructOne     +   (StructOne A, StructOne B);
static final operator(20) StructTwo     +   (StructTwo A, StructTwo B);


static final operator(34) StructOne     +=  (StructOne A, float B);
static final operator(34) float         +=  (float A, StructOne B);

static final operator(40) string        $   (coerce string A, coerce string B);
