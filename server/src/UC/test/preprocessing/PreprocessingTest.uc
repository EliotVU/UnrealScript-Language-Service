class PreprocessingTest;

var bool bEnabled;

`define conditionalTest2(msg, cond) if(`cond) { Test2(`msg); }
`define ENABLED bEnabled

function bool Test()
{
    `conditionalTest2("", bEnabled);

    return `{ENABLED};
}

function Test2(string msg)
{
    
}
