import Mocha from 'mocha';

export function run(testsRoot: string, cb: (error: any, failures?: number) => void): void {
    const mocha = new Mocha({
        ui: 'tdd',
    });

    mocha.run((failures) => {
        cb(null, failures);
    });
}
