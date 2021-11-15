class AmbiguousDeclarationsTest;

// FIXME: Both the parser and syntax highlighter are being tricked here!

const AConst = '';
const final function AmbiguousConstFunction();

final const function AmbiguousConstFunction();

function const AmbiguousConstFunction();
