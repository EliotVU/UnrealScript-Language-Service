class AmbiguousCastTest extends Object;

struct AmbiguousStruct {

};

// Working as intended: Expected behavior: cast to self (error)
function AmbiguousCastTest(Object obj) {
    AmbiguousCastTest(self);
    AmbiguousStruct(self);
}

function AmbiguousStruct(Object obj);