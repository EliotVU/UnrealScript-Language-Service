class AmbiguousOperatorOverloadingTest extends Object;

const Integer = -1;

event Created()
{
    local bool b;
    local float f;

    // FIXME: The parser cannot disambiguate identifier-based operators.
    // b = toggle true;
    b = toggle (true);

    // FIXME: Digits with a -+ sign are ambiguous with preoperators - and +
    // FIXME: MOP - expects a literal
    f = -1;
    // WORKING: expects a pre operator
    f = - 1;
    // FIXME: POP + expects a literal
    f = +1;
    // FIXME: expected to be invalid (inconsistent with the pre operator -)
    f = + 1;
    // WORKING: BOP - expects a binary operator
	f = 128.f-1.f;
    DigitsWithSign(1+1,5,5 + 5);
}

function DigitsWithSign(int i, int j, int k);

static final preoperator bool !(bool a);
static final preoperator bool toggle(bool a)
{
    return !a;
}