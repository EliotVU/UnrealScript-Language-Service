import { createToken } from '../Parser/TokenFactory';
import { toName } from '../name';
import { NAME_ARRAY } from '../names';
import {
    DEFAULT_RANGE,
    ModifierFlags,
    StaticIntType,
    StaticMetaType,
    UCMethodLikeSymbol,
    UCParamSymbol,
    UCStructSymbol,
} from './';

/** (defaultproperties) Acts as a template for array operations such as MyArray.Replace(item1, item2) etc.  */
export const DefaultArray = new UCStructSymbol({ name: NAME_ARRAY, range: DEFAULT_RANGE }, DEFAULT_RANGE);
DefaultArray.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Keyword;

const EmptyOperation = new UCMethodLikeSymbol(toName('Empty'));
EmptyOperation.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Keyword;
EmptyOperation.description = createToken('Clears the array by removing all of its elements.');
DefaultArray.addSymbol(EmptyOperation);

const AddOperation = new UCMethodLikeSymbol(toName('Add'));
AddOperation.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Keyword;
AddOperation.description = createToken('Appends the specified @param Element to the end of the array.');

const AddElementParam = new UCParamSymbol({ name: toName('Element'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticMetaType);
AddOperation.addSymbol(AddElementParam);
AddOperation.params = [AddElementParam];
DefaultArray.addSymbol(AddOperation);

const RemoveOperation = new UCMethodLikeSymbol(toName('Remove'));
RemoveOperation.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Keyword;
RemoveOperation.description = createToken('Removes any element from the array that matches the specified @param Element.');

const RemoveElementParam = new UCParamSymbol({ name: toName('Element'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticMetaType);
RemoveOperation.addSymbol(RemoveElementParam);
RemoveOperation.params = [RemoveElementParam];
DefaultArray.addSymbol(RemoveOperation);

const RemoveIndexOperation = new UCMethodLikeSymbol(toName('RemoveIndex'));
RemoveIndexOperation.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Keyword;
RemoveIndexOperation.description = createToken('Removes the element at the specified @param Index from the array.');

const RemoveIndexParam = new UCParamSymbol({ name: toName('Index'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticIntType);
RemoveIndexOperation.addSymbol(RemoveIndexParam);
RemoveIndexOperation.params = [RemoveIndexParam];
DefaultArray.addSymbol(RemoveIndexOperation);

const ReplaceOperation = new UCMethodLikeSymbol(toName('Replace'));
ReplaceOperation.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Keyword;
ReplaceOperation.description = createToken('Replaces any element that matches the specified @param Element1 with @param Element2');

const ReplaceElement1Param = new UCParamSymbol({ name: toName('Element1'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticMetaType);
const ReplaceElement2Param = new UCParamSymbol({ name: toName('Element2'), range: DEFAULT_RANGE }, DEFAULT_RANGE, StaticMetaType);
ReplaceOperation.addSymbol(ReplaceElement1Param);
ReplaceOperation.addSymbol(ReplaceElement2Param);
ReplaceOperation.params = [ReplaceElement1Param, ReplaceElement2Param];
DefaultArray.addSymbol(ReplaceOperation);
