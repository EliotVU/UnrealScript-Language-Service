import { NAME_ARRAY, toName } from '../names';
import { DEFAULT_RANGE, StaticIntType, UCMethodSymbol, UCParamSymbol, UCStructSymbol } from './';

/** (defaultproperties) Acts as a template for array operations such as MyArray.Replace(item1, item2) etc.  */
export const DefaultArray = new UCStructSymbol({ name: NAME_ARRAY, range: DEFAULT_RANGE });

const EmptyOperation = new UCMethodSymbol({ name: toName('Empty'), range: DEFAULT_RANGE });
DefaultArray.addSymbol(EmptyOperation);

const AddOperation = new UCMethodSymbol({ name: toName('Add'), range: DEFAULT_RANGE });
const AddElementParam = new UCParamSymbol({ name: toName('Element'), range: DEFAULT_RANGE });
AddOperation.addSymbol(AddElementParam);
AddOperation.params = [AddElementParam];
DefaultArray.addSymbol(AddOperation);

const RemoveOperation = new UCMethodSymbol({ name: toName('Remove'), range: DEFAULT_RANGE });
const RemoveElementParam = new UCParamSymbol({ name: toName('Element'), range: DEFAULT_RANGE });
RemoveOperation.addSymbol(RemoveElementParam);
RemoveOperation.params = [RemoveElementParam];
DefaultArray.addSymbol(RemoveOperation);

const RemoveIndexOperation = new UCMethodSymbol({ name: toName('RemoveIndex'), range: DEFAULT_RANGE });
const RemoveIndexParam = new UCParamSymbol({ name: toName('Index'), range: DEFAULT_RANGE });
RemoveIndexParam.type = StaticIntType;
RemoveIndexOperation.addSymbol(RemoveIndexParam);
RemoveIndexOperation.params = [RemoveIndexParam];
DefaultArray.addSymbol(RemoveIndexOperation);

const ReplaceOperation = new UCMethodSymbol({ name: toName('Replace'), range: DEFAULT_RANGE });
const ReplaceElement1Param = new UCParamSymbol({ name: toName('Element1'), range: DEFAULT_RANGE });
const ReplaceElement2Param = new UCParamSymbol({ name: toName('Element2'), range: DEFAULT_RANGE });
ReplaceOperation.addSymbol(ReplaceElement1Param);
ReplaceOperation.addSymbol(ReplaceElement2Param);
ReplaceOperation.params = [ReplaceElement1Param, ReplaceElement2Param];
DefaultArray.addSymbol(ReplaceOperation);