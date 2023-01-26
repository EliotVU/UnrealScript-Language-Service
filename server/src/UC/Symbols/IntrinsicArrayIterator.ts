import { toName } from '../name';
import { DEFAULT_RANGE, MethodFlags, ModifierFlags, StaticIntType, StaticMetaType, UCMethodLikeSymbol, UCParamSymbol } from '.';

export const ArrayIterator = new UCMethodLikeSymbol(toName('Iterator'));
ArrayIterator.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.ReadOnly | ModifierFlags.NoDeclaration;
ArrayIterator.specifiers |= MethodFlags.Iterator | MethodFlags.Static || MethodFlags.Final;
const OutParam = new UCParamSymbol({ name: toName('Element'), range: DEFAULT_RANGE });
OutParam.type = StaticMetaType;
OutParam.modifiers |= ModifierFlags.Out;
ArrayIterator.addSymbol(OutParam);
const IndexParam = new UCParamSymbol({ name: toName('Index'), range: DEFAULT_RANGE });
IndexParam.type = StaticIntType;
IndexParam.modifiers |= ModifierFlags.Out;
ArrayIterator.addSymbol(IndexParam);
ArrayIterator.params = [OutParam, IndexParam];
