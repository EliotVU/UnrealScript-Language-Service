/*==============================================================================
	A Comment
	Another Line
==============================================================================*/
class test extends Mutator
	config(MyConfigFileName)
	notplaceable;

struct sInventoryCollection
{
	/** MultiComment 1 */
	var() config int ScoreReq;
	var() config array< class<Inventory> > Inventories;
};

struct sStruct2 extends sInventoryCollection
{
	struct sSubStruct
	{
		var() public const int TestVar, TestVar2;
	};
};

var() config array<sInventoryCollection> LoadedLevels;
var() config bool bUseKills;
var() config bool bBalanceWithDeaths;

var protected LoadedRules LR;

simulated event PostBeginPlay()
{
	local xPickupBase P;
	local WeaponLocker WL;
}

final static function StubFunctionVoid();
final static function StubFunctionVoid2(int int1) const;

final static function string StubFunction(
	int Int0,
	out float TestParam1,
	optional coerce string TestParam2)
{
	local int Int1;
}