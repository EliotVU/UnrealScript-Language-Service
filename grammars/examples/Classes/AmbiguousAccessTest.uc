class AmbiguousAccessTest extends Object;

struct TestStruct {
    var Vector default;
};

/** The 'default' specifier is ambiguous when used on a struct. */
function AmbiguousAccessTest() {
    local TestStruct test;
    local Vector V;

    // Working as expected
    v = test.default;

    // Missing support.
    test.default.X;

    // false positive, the linter should output an error.
    v = test.default.default;

    v = TestStruct().default;
    TestStruct().default.X;
    TestStruct().default.default;
}

function TestStruct TestStruct();