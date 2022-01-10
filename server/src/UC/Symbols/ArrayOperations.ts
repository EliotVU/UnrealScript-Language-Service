import { toName } from '../name';
import { NAME_ARRAY } from '../names';
import {
    DEFAULT_RANGE, ModifierFlags, StaticIntType, UCMethodLikeSymbol, UCParamSymbol, UCStructSymbol
} from './';

/** (defaultproperties) Acts as a template for array operations such as MyArray.Replace(item1, item2) etc.  */
export const DefaultArray = new UCStructSymbol({ name: NAME_ARRAY, range: DEFAULT_RANGE });
DefaultArray.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Keyword;

const EmptyOperation = new UCMethodLikeSymbol(toName('Empty'));
EmptyOperation.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Keyword;
DefaultArray.addSymbol(EmptyOperation);

const AddOperation = new UCMethodLikeSymbol(toName('Add'));
AddOperation.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Keyword;
const AddElementParam = new UCParamSymbol({ name: toName('Element'), range: DEFAULT_RANGE });
AddOperation.addSymbol(AddElementParam);
AddOperation.params = [AddElementParam];
DefaultArray.addSymbol(AddOperation);

const RemoveOperation = new UCMethodLikeSymbol(toName('Remove'));
RemoveOperation.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Keyword;
const RemoveElementParam = new UCParamSymbol({ name: toName('Element'), range: DEFAULT_RANGE });
RemoveOperation.addSymbol(RemoveElementParam);
RemoveOperation.params = [RemoveElementParam];
DefaultArray.addSymbol(RemoveOperation);

const RemoveIndexOperation = new UCMethodLikeSymbol(toName('RemoveIndex'));
RemoveIndexOperation.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Keyword;
const RemoveIndexParam = new UCParamSymbol({ name: toName('Index'), range: DEFAULT_RANGE });
RemoveIndexParam.type = StaticIntType;
RemoveIndexOperation.addSymbol(RemoveIndexParam);
RemoveIndexOperation.params = [RemoveIndexParam];
DefaultArray.addSymbol(RemoveIndexOperation);

const ReplaceOperation = new UCMethodLikeSymbol(toName('Replace'));
ReplaceOperation.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Keyword;
const ReplaceElement1Param = new UCParamSymbol({ name: toName('Element1'), range: DEFAULT_RANGE });
const ReplaceElement2Param = new UCParamSymbol({ name: toName('Element2'), range: DEFAULT_RANGE });
ReplaceOperation.addSymbol(ReplaceElement1Param);
ReplaceOperation.addSymbol(ReplaceElement2Param);
ReplaceOperation.params = [ReplaceElement1Param, ReplaceElement2Param];
DefaultArray.addSymbol(ReplaceOperation);