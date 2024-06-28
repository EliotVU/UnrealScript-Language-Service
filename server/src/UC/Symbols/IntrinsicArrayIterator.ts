import {
    DEFAULT_RANGE,
    MethodFlags,
    StaticIntType,
    StaticMetaType,
    UCMethodLikeSymbol,
    UCParamSymbol,
} from '.';
import { toName } from '../name';
import { ModifierFlags } from './ModifierFlags';

export const ArrayIterator = new UCMethodLikeSymbol(toName('Iterator'));
ArrayIterator.modifiers |= ModifierFlags.Intrinsic | ModifierFlags.ReadOnly | ModifierFlags.NoDeclaration;
ArrayIterator.specifiers |= MethodFlags.Iterator | MethodFlags.Static | MethodFlags.Final;
const OutParam = new UCParamSymbol(
    { name: toName('Element'), range: DEFAULT_RANGE },
    DEFAULT_RANGE,
    Object.create(StaticMetaType, { flags: { value: ModifierFlags.Out } })
);
OutParam.modifiers |= ModifierFlags.Out;
ArrayIterator.addSymbol(OutParam);
const IndexParam = new UCParamSymbol(
    { name: toName('Index'), range: DEFAULT_RANGE },
    DEFAULT_RANGE,
    Object.create(StaticIntType, { flags: { value: ModifierFlags.Out } })
);
IndexParam.modifiers |= ModifierFlags.Out | ModifierFlags.Optional;
ArrayIterator.addSymbol(IndexParam);
ArrayIterator.params = [OutParam, IndexParam];
