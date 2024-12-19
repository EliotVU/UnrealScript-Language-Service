class PreprocessingTest;

var name Name;

var bool bEnabled;
var float TimeSeconds;

`define IsEnabled bEnabled
// FIXME: Parser stops parsing after this unexpected macro usage.
// `isdefined(IsEnabled)

function bool ShouldBeValidEnclosedMacroTest()
{
    return `{IsEnabled};
}

static final operator(20) int + (int A, int B);

// Test a more 'complex' macro that is defined "locally"
function float ShouldBeValidMacroTest()
{
    `define MyNumber 1

    return `MyNumber+2;
}

// Should still pickup ``define MyNumber 1`
function float ShouldBeValidMacroTest2()
{
    return `MyNumber;

    `undefine(MyNumber)
}

private function Log(string msg, optional name tag);

`define FormatBool(cond) string(`cond)
`define LogConditionalMessage(msg, cond) if(`cond) Log(`msg)

function ShouldBeValidArgumentMacroTest()
{
    local string s;

    s = `FormatBool(bEnabled);

    `LogConditionalMessage("text here", bEnabled);
}

function ShouldBeInvalidArgumentMacroTest()
{
    `LogConditionalMessage("text here", "bEnabled");
}

// Real example as seen in UDK

`define TimeSince(World, Time)	 (`World.TimeSeconds - `Time)

native(175) static final operator(20) float -  ( float A, float B );
native(176) static final operator(24) bool  <  ( float A, float B );

function bool ShouldBeValidReturnMacroTest()
{
    local float LastRenderTime;

    return ( `TimeSince( (self), LastRenderTime ) < 0.3 );
}

native(112) static final operator(40) string $  ( coerce string A, coerce string B );

// ! TODO: Support non-macro code inbetween `if and `endif and enclosed `{endif}
`define	Log(msg,cond,tag)	`if(`cond)if(`cond)`{endif} Log(`msg`if(`tag),`tag`{endif})
`define	Location	"("$Name$") `{ClassName}::"$Name

function ShouldBeValidInceptionMacroTest()
{
    // FIXME: No condition doesn't work yet
    // `Log("");

    `Log(`location $ "string", true, 'tag');

    `Log("a"
        $ "b"
        $ "c"
        $ "d",
        true,
        'tag'
    );
}
