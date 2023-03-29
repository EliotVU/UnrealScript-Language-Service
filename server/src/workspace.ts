import glob from 'glob';

// FIXME: case-sensitive
export function isPackageFileName(fileName: string): boolean {
    return !!fileName.match(/.{u}$/i);
}

// FIXME: Use glob pattern, and make the extension configurable.
export function isDocumentFileName(fileName: string): boolean {
    // Implied because we only receive one of the two.
    return !isPackageFileName(fileName);
}

export function getFiles(folderPath: string, pattern: string): Promise<string[]> {
    return glob(pattern, {
        cwd: folderPath,
        nocase: true,
        nodir: true,
        absolute: true,
        ignore: 'node_modules/**'
    });
}