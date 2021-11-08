class AmbiguousCallTest extends Object;

// Not working: Expected behavior: recursive call, however the LSP doesn't pick up on this.
// In UnrealScript a class has precedence over a function unless it has a non-object parameter?
function AmbiguousCallTest(int i) {
    AmbiguousCallTest(0);
}