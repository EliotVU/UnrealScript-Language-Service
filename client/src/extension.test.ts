import { runTests } from '@vscode/test-electron';
import path from 'node:path';

((async () => {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        const extensionTestsPath = path.resolve(__dirname, './test/index.ts');

        const workspacePath = path.resolve(__dirname, './test/workspace');

        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [workspacePath],
        });
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}))();
