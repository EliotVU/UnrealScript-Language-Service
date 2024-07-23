class PreprocessingTest;

var bool bEnabled;

`define LogConditionalMessage(msg, cond) if(`cond) { Log(`msg); }
`define FormatBool(cond) string(`cond)

`define IsEnabled bEnabled

function ShouldBeValidArgumentMacroTest()
{
    `LogConditionalMessage("", bEnabled);
    `FormatBool(bEnabled);
}

function bool ShouldBeValidInlineMacroTest()
{
    return `{IsEnabled};
}

private function Log(string msg);
