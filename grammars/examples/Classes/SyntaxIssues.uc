class SyntaxIssues
    // FIXME: Clauses on a new line are not being highlighted.
    extends Object
    placeable;

// struct {FType*} CppStruct
// {
//     structcpptext
//     {
//         {}
//     }

// 	var native const pointer Dummy{FType};
// };

// struct native long myStruct
// {};

struct anotherStruct
    // FIXME: Clauses on a new line are not being highlighted.
    extends myStruct
{};

// var public{cppModifier} int TestProp;
// var Map{FType, class FType*} MapProperty;

function test()
{
    local SyntaxIssues bool;
    local float f;

    // FIXME: The function is marked as the stop control flow used in a state's code block.
    self.Stop();

    // FIXME: Alpha is not being highlighted as an identifier
	bool = bool ? self : self;

    // FIXME: f here is not being highlighted unless a 0 is preceded.
    f = 0.f;

    // FIXME: Switch is being mistaken for the switch statement.
    self.Switch	= Switch;

	if ( true == false )	// comment
		false = true;
}

// FIXME: Let expression is not being highlighted.
function Stop(optional int f = 1000);

// FIXME: Function name and its parameters are not being highlighted.
function int parameters
(
    SyntaxIssues obj,
    SyntaxIssues Obj2
);

// FIXME: Function name is highlighted as the return type.
function parametersNoReturnType
();

// FIXME: modifiers can appear after the function keyword.
function final static PostModifiers();