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

    // Wrong order
    foreach array(i, s);

    // ! "An element access expression should take an argument."
    array[];

    // ! "Type of 'None.ArrayTest.ShouldBeInvalidArrayIteratorTest.B' is not a valid array."
    b[0];

    b[""];
}
