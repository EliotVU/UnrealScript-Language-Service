class Gamma;

var Link Link;
var Alpha AlphaRef;
var private Alpha ArchetypeA;

`define PP_A ArchetypeA

function Test() {

	local byte cmd;

	switch( cmd )
	{
		case 0:
		case 1:
			`PP_A.AlphaTest();
			break;
		case 2:
		case 3:
		case 4:
			`PP_A.AlphaTest();
			`PP_A.AlphaTest();
			`{PP_A}.AlphaTest();
			break;
	}
}

defaultproperties
{
	begin object name=AlphaArchetype class=Alpha
		GammaRef=none
	end object
	ArchetypeA=AlphaArchetype
}