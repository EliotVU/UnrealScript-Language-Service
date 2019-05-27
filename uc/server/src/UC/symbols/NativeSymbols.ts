import {
	UCPackage,
	UCNativeSymbol,
	UCStructSymbol,
	UCClassSymbol,
	UCPropertySymbol,
	UCMethodSymbol,
	UCMethodLikeSymbol,
	UCTypeSymbol,
	UCParamSymbol,
	SymbolsTable
} from ".";
import { UCTypeKind } from './TypeKind';
import { DEFAULT_RANGE } from './Symbol';

export const ObjectType = new UCTypeSymbol('Object', DEFAULT_RANGE, DEFAULT_RANGE, UCTypeKind.Class);
export const ArgumentType = new UCTypeSymbol('Argument', DEFAULT_RANGE);
export const IntType = new UCTypeSymbol('int', DEFAULT_RANGE);
export const FloatType = new UCTypeSymbol('float', DEFAULT_RANGE);
export const PropertyType = new UCTypeSymbol('Property', DEFAULT_RANGE);
export const VectorType = new UCTypeSymbol('Vector', DEFAULT_RANGE);
export const RotatorType = new UCTypeSymbol('Rotator', DEFAULT_RANGE);
export const RangeType = new UCTypeSymbol('Range', DEFAULT_RANGE);

// A Class type instance has all the members of an object.
export const NativeClass = new UCClassSymbol('Class', DEFAULT_RANGE, DEFAULT_RANGE);
NativeClass.extendsType = ObjectType;

// Not really a class, but valid as an object literal where enum is given as the class? e.g. Enum'ENetRole'
export const NativeEnum = new UCClassSymbol('Enum', DEFAULT_RANGE, DEFAULT_RANGE);

export const NativeArray = new UCStructSymbol('Array', DEFAULT_RANGE, DEFAULT_RANGE);

	const LengthProperty = new UCPropertySymbol('Length', DEFAULT_RANGE, DEFAULT_RANGE);
	LengthProperty.type = new UCTypeSymbol('int', DEFAULT_RANGE);
	NativeArray.addSymbol(LengthProperty);

	const InsertFunction = new UCMethodSymbol('Insert', DEFAULT_RANGE, DEFAULT_RANGE);
	NativeArray.addSymbol(InsertFunction);

		const IndexParam = new UCParamSymbol('index', DEFAULT_RANGE, DEFAULT_RANGE);
		IndexParam.type = IntType;
		InsertFunction.addSymbol(IndexParam);

		const CountParam = new UCParamSymbol('count', DEFAULT_RANGE, DEFAULT_RANGE);
		CountParam.type = IntType;
		InsertFunction.addSymbol(CountParam);

		InsertFunction.params = [IndexParam, CountParam];

	const RemoveFunction = new UCMethodSymbol('Remove', DEFAULT_RANGE, DEFAULT_RANGE);
	NativeArray.addSymbol(RemoveFunction);

	const AddFunction = new UCMethodSymbol('Add', DEFAULT_RANGE, DEFAULT_RANGE);
	NativeArray.addSymbol(AddFunction);

	const AddItemFunction = new UCMethodSymbol('AddItem', DEFAULT_RANGE, DEFAULT_RANGE);
	NativeArray.addSymbol(AddItemFunction);

	const InsertItemFunction = new UCMethodSymbol('InsertItem', DEFAULT_RANGE, DEFAULT_RANGE);
	NativeArray.addSymbol(InsertItemFunction);

	const RemoveItemFunction = new UCMethodSymbol('RemoveItem', DEFAULT_RANGE, DEFAULT_RANGE);
	NativeArray.addSymbol(RemoveItemFunction);

	const FindFunction = new UCMethodSymbol('Find', DEFAULT_RANGE, DEFAULT_RANGE);
	NativeArray.addSymbol(FindFunction);

	const SortFunction = new UCMethodSymbol('Sort', DEFAULT_RANGE, DEFAULT_RANGE);
	NativeArray.addSymbol(SortFunction);

export const VectMethodLike = new UCMethodLikeSymbol('vect');
	VectMethodLike.returnType = VectorType;

	const XParam = new UCParamSymbol('X', DEFAULT_RANGE, DEFAULT_RANGE);
	XParam.type = FloatType;
	VectMethodLike.addSymbol(XParam);

	const YParam = new UCParamSymbol('Y', DEFAULT_RANGE, DEFAULT_RANGE);
	YParam.type = FloatType;
	VectMethodLike.addSymbol(YParam);

	const ZParam = new UCParamSymbol('Z', DEFAULT_RANGE, DEFAULT_RANGE);
	ZParam.type = FloatType;
	VectMethodLike.addSymbol(ZParam);

	VectMethodLike.params = [XParam, YParam, ZParam];

export const RotMethodLike = new UCMethodLikeSymbol('rot');
	RotMethodLike.returnType = RotatorType;

	const PitchParam = new UCParamSymbol('Pitch', DEFAULT_RANGE, DEFAULT_RANGE);
	PitchParam.type = IntType;
	RotMethodLike.addSymbol(PitchParam);

	const YawParam = new UCParamSymbol('Yaw', DEFAULT_RANGE, DEFAULT_RANGE);
	YawParam.type = IntType;
	RotMethodLike.addSymbol(YawParam);

	const RollParam = new UCParamSymbol('Roll', DEFAULT_RANGE, DEFAULT_RANGE);
	RollParam.type = IntType;
	RotMethodLike.addSymbol(RollParam);

	RotMethodLike.params = [PitchParam, YawParam, RollParam];

export const RngMethodLike = new UCMethodLikeSymbol('rng');
	RngMethodLike.returnType = RangeType;

	const MinParam = new UCParamSymbol('Min', DEFAULT_RANGE, DEFAULT_RANGE);
	MinParam.type = FloatType;
	RngMethodLike.addSymbol(MinParam);

	const MaxParam = new UCParamSymbol('Max', DEFAULT_RANGE, DEFAULT_RANGE);
	MaxParam.type = FloatType;
	RngMethodLike.addSymbol(MaxParam);

	RngMethodLike.params = [MinParam, MaxParam];

export const AssignmentOperator = new UCMethodLikeSymbol('=', 'operator');
	const AParam = new UCParamSymbol('variable', DEFAULT_RANGE, DEFAULT_RANGE);
	AParam.type = PropertyType;
	AssignmentOperator.addSymbol(AParam);

	const BParam = new UCParamSymbol('value', DEFAULT_RANGE, DEFAULT_RANGE);
	BParam.type = ArgumentType;
	AssignmentOperator.addSymbol(BParam);

	AssignmentOperator.params = [AParam, BParam];

export const CORE_PACKAGE = new UCPackage('Core');

// IMPORTANT: This package must be added before adding anything to the CORE_PACKAGE!
SymbolsTable.addSymbol(CORE_PACKAGE);

	CORE_PACKAGE.addSymbol(NativeClass);
	CORE_PACKAGE.addSymbol(NativeEnum);
	CORE_PACKAGE.addSymbol(NativeArray);
	CORE_PACKAGE.addSymbol(new UCNativeSymbol('byte'));
	CORE_PACKAGE.addSymbol(new UCNativeSymbol('float'));
	CORE_PACKAGE.addSymbol(new UCNativeSymbol('int'));
	CORE_PACKAGE.addSymbol(new UCNativeSymbol('string'));
	CORE_PACKAGE.addSymbol(new UCNativeSymbol('name'));
	CORE_PACKAGE.addSymbol(new UCNativeSymbol('bool'));
	CORE_PACKAGE.addSymbol(new UCNativeSymbol('pointer'));
	CORE_PACKAGE.addSymbol(new UCNativeSymbol('map'));
	CORE_PACKAGE.addSymbol(new UCNativeSymbol('Delegate'));
	CORE_PACKAGE.addSymbol(new UCNativeSymbol('button'));
	CORE_PACKAGE.addSymbol(PropertyType);
