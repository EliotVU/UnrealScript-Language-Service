import { toName } from '../name';
import { NAME_ARRAY } from '../names';
import {
    DEFAULT_RANGE, ModifierFlags, StaticIntType, StaticMetaType, UCMethodLikeSymbol, UCParamSymbol,
    UCStructSymbol
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
AddElementParam.type = StaticMetaType;
AddOperation.addSymbol(AddElementParam);
AddOperation.params = [AddElementParam];
DefaultArray.addSymbol(AddOperation);

const RemoveOperation = new UCMethodLikeSymbol(toName('Remove'));
RemoveOperation.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.Keyword;
const RemoveElementParam = new UCParamSymbol({ name: toName('Element'), range: DEFAULT_RANGE });
RemoveElementParam.type = StaticMetaType;
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
ReplaceElement1Param.type = StaticMetaType;
const ReplaceElement2Param = new UCParamSymbol({ name: toName('Element2'), range: DEFAULT_RANGE });
ReplaceElement2Param.type = StaticMetaType;
ReplaceOperation.addSymbol(ReplaceElement1Param);
ReplaceOperation.addSymbol(ReplaceElement2Param);
ReplaceOperation.params = [ReplaceElement1Param, ReplaceElement2Param];
DefaultArray.addSymbol(ReplaceOperation);