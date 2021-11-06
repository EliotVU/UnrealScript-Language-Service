class AmbiguousCastTest extends Object;

// Working as intended: Expected behavior: cast to self (error)
function AmbiguousCastTest(object obj) {
    AmbiguousCastTest(self);
}