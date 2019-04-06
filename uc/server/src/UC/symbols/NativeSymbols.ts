import { UCPackage, UCNativeSymbol, UCClassSymbol, UCPropertySymbol, UCMethodSymbol, UCTypeSymbol, UCParamSymbol, SymbolsTable } from ".";
import { UCTypeKind } from './TypeKind';

export const CORE_PACKAGE = new UCPackage('Core');

// A Class type instance has all the members of an object.
export const NativeClass = new UCClassSymbol('Class', undefined, undefined);
NativeClass.extendsType = new UCTypeSymbol('Object', undefined, undefined, UCTypeKind.Class);
CORE_PACKAGE.addSymbol(NativeClass);

export const IntType = new UCTypeSymbol('int', undefined);

export const NativeArray = new UCClassSymbol('Array', undefined, undefined);
CORE_PACKAGE.addSymbol(NativeArray);

	const LengthProperty = new UCPropertySymbol('Length', undefined, undefined);
	LengthProperty.type = new UCTypeSymbol('int', undefined, undefined);
	NativeArray.addSymbol(LengthProperty);

	const InsertFunction = new UCMethodSymbol('Insert', undefined, undefined);
	NativeArray.addSymbol(InsertFunction);

		const IndexParam = new UCParamSymbol('index', undefined, undefined);
		IndexParam.type = IntType;
		InsertFunction.addSymbol(IndexParam);

		const CountParam = new UCParamSymbol('count', undefined, undefined);
		CountParam.type = IntType;
		InsertFunction.addSymbol(CountParam);

		InsertFunction.params = [IndexParam, CountParam];

	const RemoveFunction = new UCMethodSymbol('Remove', undefined, undefined);
	NativeArray.addSymbol(RemoveFunction);

	const AddFunction = new UCMethodSymbol('Add', undefined, undefined);
	NativeArray.addSymbol(AddFunction);

	const AddItemFunction = new UCMethodSymbol('AddItem', undefined, undefined);
	NativeArray.addSymbol(AddItemFunction);

	const InsertItemFunction = new UCMethodSymbol('InsertItem', undefined, undefined);
	NativeArray.addSymbol(InsertItemFunction);

	const RemoveItemFunction = new UCMethodSymbol('RemoveItem', undefined, undefined);
	NativeArray.addSymbol(RemoveItemFunction);

	const FindFunction = new UCMethodSymbol('Find', undefined, undefined);
	NativeArray.addSymbol(FindFunction);

	const SortFunction = new UCMethodSymbol('Sort', undefined, undefined);
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