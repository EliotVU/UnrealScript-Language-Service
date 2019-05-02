import { UCPackage, UCNativeSymbol, UCClassSymbol, UCPropertySymbol, UCMethodSymbol, UCMethodLikeSymbol, UCTypeSymbol, UCParamSymbol, SymbolsTable } from ".";
import { UCTypeKind } from './TypeKind';

export const CORE_PACKAGE = new UCPackage('Core');

// A Class type instance has all the members of an object.
export const NativeClass = new UCClassSymbol('Class');
NativeClass.extendsType = new UCTypeSymbol('Object', undefined, undefined, UCTypeKind.Class);
CORE_PACKAGE.addSymbol(NativeClass);

export const ArgumentType = new UCTypeSymbol('Argument', undefined);
export const IntType = new UCTypeSymbol('int', undefined);
export const FloatType = new UCTypeSymbol('float', undefined);
export const PropertyType = new UCTypeSymbol('Property', undefined);
export const VectorType = new UCTypeSymbol('Vector', undefined);
export const RotatorType = new UCTypeSymbol('Rotator', undefined);
export const RangeType = new UCTypeSymbol('Range', undefined);

export const NativeArray = new UCClassSymbol('Array');
CORE_PACKAGE.addSymbol(NativeArray);

	const LengthProperty = new UCPropertySymbol('Length');
	LengthProperty.type = new UCTypeSymbol('int', undefined);
	NativeArray.addSymbol(LengthProperty);

	const InsertFunction = new UCMethodSymbol('Insert');
	NativeArray.addSymbol(InsertFunction);

		const IndexParam = new UCParamSymbol('index');
		IndexParam.type = IntType;
		InsertFunction.addSymbol(IndexParam);

		const CountParam = new UCParamSymbol('count');
		CountParam.type = IntType;
		InsertFunction.addSymbol(CountParam);

		InsertFunction.params = [IndexParam, CountParam];

	const RemoveFunction = new UCMethodSymbol('Remove');
	NativeArray.addSymbol(RemoveFunction);

	const AddFunction = new UCMethodSymbol('Add');
	NativeArray.addSymbol(AddFunction);

	const AddItemFunction = new UCMethodSymbol('AddItem');
	NativeArray.addSymbol(AddItemFunction);

	const InsertItemFunction = new UCMethodSymbol('InsertItem');
	NativeArray.addSymbol(InsertItemFunction);

	const RemoveItemFunction = new UCMethodSymbol('RemoveItem');
	NativeArray.addSymbol(RemoveItemFunction);

	const FindFunction = new UCMethodSymbol('Find');
	NativeArray.addSymbol(FindFunction);

	const SortFunction = new UCMethodSymbol('Sort');
	NativeArray.addSymbol(SortFunction);

const NATIVE_SYMBOLS = [
	new UCNativeSymbol('byte'),
	new UCNativeSymbol('float'),
	new UCNativeSymbol('int'),
	new UCNativeSymbol('string'),
	new UCNativeSymbol('name'),
	new UCNativeSymbol('bool'),
	new UCNativeSymbol('pointer'),
	new UCNativeSymbol('map'),
	new UCNativeSymbol('Delegate'),
	new UCNativeSymbol('button')
];

NATIVE_SYMBOLS.forEach(symbol => {
	CORE_PACKAGE.addSymbol(symbol);
});

SymbolsTable.addSymbol(CORE_PACKAGE);

export const VectMethodLike = new UCMethodLikeSymbol('vect');
	VectMethodLike.returnType = VectorType;

	const XParam = new UCParamSymbol('X');
	XParam.type = FloatType;
	VectMethodLike.addSymbol(XParam);

	const YParam = new UCParamSymbol('Y');
	YParam.type = FloatType;
	VectMethodLike.addSymbol(YParam);

	const ZParam = new UCParamSymbol('Z');
	ZParam.type = FloatType;
	VectMethodLike.addSymbol(ZParam);

	VectMethodLike.params = [XParam, YParam, ZParam];

export const RotMethodLike = new UCMethodLikeSymbol('rot');
	RotMethodLike.returnType = RotatorType;

	const PitchParam = new UCParamSymbol('Pitch');
	PitchParam.type = IntType;
	RotMethodLike.addSymbol(PitchParam);

	const YawParam = new UCParamSymbol('Yaw');
	YawParam.type = IntType;
	RotMethodLike.addSymbol(YawParam);

	const RollParam = new UCParamSymbol('Roll');
	RollParam.type = IntType;
	RotMethodLike.addSymbol(RollParam);

	RotMethodLike.params = [PitchParam, YawParam, RollParam];

export const RngMethodLike = new UCMethodLikeSymbol('rng');
	RngMethodLike.returnType = RangeType;

	const MinParam = new UCParamSymbol('Min');
	MinParam.type = FloatType;
	RngMethodLike.addSymbol(MinParam);

	const MaxParam = new UCParamSymbol('Max');
	MaxParam.type = FloatType;
	RngMethodLike.addSymbol(MaxParam);

	RngMethodLike.params = [MinParam, MaxParam];

export const AssignmentOperator = new UCMethodLikeSymbol('=', 'operator');

	const AParam = new UCParamSymbol('variable');
	AParam.type = PropertyType;
	AssignmentOperator.addSymbol(AParam);

	const BParam = new UCParamSymbol('value');
	BParam.type = ArgumentType;
	AssignmentOperator.addSymbol(BParam);

	AssignmentOperator.params = [AParam, BParam];