import { expect } from 'chai';

import { NAME_CLASS, NAME_PACKAGE, NAME_STRUCT } from '../names';
import { DEFAULT_RANGE, UCClassSymbol, UCScriptStructSymbol } from './';
import { UCPackage } from './Package';

/**
 * Ensure that the ObjectsTable can properly distinguish a package and a class of the same name.
 **/
describe('Test Symbol Methods', () => {
    const packageSymbol = new UCPackage(NAME_PACKAGE);

    const classSymbol = new UCClassSymbol({ name: NAME_CLASS, range: DEFAULT_RANGE });
    classSymbol.outer = packageSymbol;

    const scriptStructSymbol = new UCScriptStructSymbol({ name: NAME_STRUCT, range: DEFAULT_RANGE });
    classSymbol.addSymbol(scriptStructSymbol);

    it('GetPath() === "Package.Class.Struct"', () => {
        expect(packageSymbol.getPath())
            .to.equal(NAME_PACKAGE.text);
        expect(classSymbol.getPath())
            .to.equal(`${NAME_PACKAGE.text}.${NAME_CLASS.text}`);
        expect(scriptStructSymbol.getPath())
            .to.equal(`${NAME_PACKAGE.text}.${NAME_CLASS.text}.${NAME_STRUCT.text}`);
    });
});
