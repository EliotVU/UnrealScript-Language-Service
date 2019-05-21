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

export const ObjectType = new UCTypeSymbol('Object', undefined, undefined, UCTypeKind.Class);
export const ArgumentType = new UCTypeSymbol('Argument', undefined);
export const IntType = new UCTypeSymbol('int', undefined);
export const FloatType = new UCTypeSymbol('float', undefined);
export const PropertyType = new UCTypeSymbol('Property', undefined);
export const VectorType = new UCTypeSymbol('Vector', undefined);
export const RotatorType = new UCTypeSymbol('Rotator', undefined);
export const RangeType = new UCTypeSymbol('Range', undefined);

// A Class type instance has all the members of an object.
export const NativeClass = new UCClassSymbol('Class');
NativeClass.extendsType = ObjectType;

// Not really a class, but valid as an object literal where enum is given as the class? e.g. Enum'ENetRole'
export const NativeEnum = new UCClassSymbol('Enum');

export const NativeArray = new UCStructSymbol('Array');

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
