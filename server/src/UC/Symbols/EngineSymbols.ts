import { toName } from '../name';
import { NAME_ENGINE } from '../names';
import { addHashedSymbol, DEFAULT_RANGE, IntrinsicObject, UCClassSymbol, UCPackage } from './';
import { ModifierFlags } from './ModifierFlags';

export const ENGINE_PACKAGE = new UCPackage(NAME_ENGINE);
addHashedSymbol(ENGINE_PACKAGE);

export const IntrinsicMaterial = new UCClassSymbol({
    name: toName('Material'),
    range: DEFAULT_RANGE
}, DEFAULT_RANGE);
IntrinsicMaterial.modifiers |= ModifierFlags.Intrinsic;
IntrinsicMaterial.super = IntrinsicObject;
IntrinsicMaterial.outer = ENGINE_PACKAGE;
// addHashedSymbol(IntrinsicMaterial);

export const IntrinsicTexture = new UCClassSymbol({
    name: toName('Texture'),
    range: DEFAULT_RANGE
}, DEFAULT_RANGE);
IntrinsicTexture.modifiers |= ModifierFlags.Intrinsic;
IntrinsicTexture.super = IntrinsicMaterial;
IntrinsicTexture.outer = ENGINE_PACKAGE;
// addHashedSymbol(IntrinsicTexture);
