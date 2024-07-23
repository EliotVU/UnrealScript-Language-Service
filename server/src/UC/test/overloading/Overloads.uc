// Operator overloads to help with the testing of finding the correct overloaded operator even if that involves more complicated overloading types such as a struct.
class Overloads;

enum EnumOne {
    EO_1
};

struct StructOne {};
struct StructTwo {};

static final preoperator  byte          ++      (out byte A);
static final preoperator  int           ++      (out int A);

static final postoperator byte          ++      (out byte A);
static final postoperator int           ++      (out int A);

static final operator(24) bool          ==      (bool A, bool B);
static final operator(24) bool          ==      (int A, int B);
static final operator(24) bool          ==      (float A, float B);
static final operator(24) bool          ==      (name A, name B);
static final operator(24) bool          ==      (string A, string B);

static final operator(24) bool          ==      (Object A, Object B);
static final operator(26) bool          !=      (Object A, Object B);

static final operator(24) bool          ==      (Interface A, Interface B);
static final operator(26) bool          !=      (Interface A, Interface B);

static final operator(20) int           +       (int A, int B);
static final operator(20) float         +       (float A, float B);
static final operator(20) StructOne     +       (StructOne A, StructOne B);
static final operator(20) StructTwo     +       (StructTwo A, StructTwo B);


static final operator(34) StructOne     +=      (out StructOne A, float B);
static final operator(34) float         +=      (out float A, StructOne B);

// For some reason Epic hasn't defined a int *= int operator? So let's use these to test mixed overloads
static final operator(34) byte          *=      (out byte A, byte B);
static final operator(34) byte          *=      (out byte A, float B);
static final operator(34) int           *=      (out int A, float B);
static final operator(34) float         *=      (out float A, float B);

static final operator(40) string        $       (coerce string A, coerce string B);
