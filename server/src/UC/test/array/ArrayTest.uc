class ArrayTest;

var array<string> array;

function ShouldBeValidArrayIteratorTest()
{
    local string s;
    local int i;

    // ! UC3 "Type 'Array' cannot be iterated. Expected an iterator function."
    foreach array(s, i);

    // ! index should be optional
    foreach array(s);

    array[0] = "";
    array[0.0] = "";
}

function ShouldBeInvalidArrayIteratorTest()
{
    local string s;
    local int i;

// #if UC2
//     // ! UC2 "Type 'Array' cannot be iterated. Expected an iterator function."
//     foreach array(s, i);
// #endif

    // ! Expected "Missing iterator arguments."
    foreach array();
    // ! Expected "Expression does not evaluate to an iteratable."
    foreach array;

    // ! Wrong argument order
    foreach array(i, s);

    // ! Expected "An element access expression should take an argument."
    array[];

    // ! Expected "Type of 'None.ArrayTest.ShouldBeInvalidArrayIteratorTest.B' is not a valid array."
    s[0];

    s[""];
}
