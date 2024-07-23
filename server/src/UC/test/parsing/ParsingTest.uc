class ParsingTest extends Core.Object;

// Ensure we have no grammar parsing errors for all statements.
function ShouldBeValidStatementsTest()
{
    local array<int> array;
    local int v, i;

    if (true);
    if (true) return;

    if (true) {

    } else if (true) {

    } else {

    }

    for (i = 0; i < array.Length; ++ i);
    for (i = 0; i < array.Length; ++ i) break;

    for (i = 0; i < array.Length; ++ i) {
        break;
        continue;
    }

    foreach array(v, i);
    foreach array(v, i) break;

    foreach array(v, i) {
        break;
        continue;
    }

    while (true);
    while (true) break;
    while (true) {
        break;
        continue;
    }

    do break;
    do until (true);

    do {
        break;
        continue;
    }

    do {
        break;
        continue;
    } until (true);

    switch (i) {
        case 0:
            break;

        default:
            break;
    }

    return;
    return 0;

    goto return1;
return1:

    assert (true);
    stop;
}

function ShouldBeInvalidPrimaryExpressionTest()
{
    Class'Object'(self);
}
