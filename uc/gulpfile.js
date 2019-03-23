const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const jsyaml = require('js-yaml');

const syntaxFile = 'UnrealScript.YAML-tmLanguage';
const outSynaxFile = 'UnrealScript.tmLanguage.json';
const syntaxDir = 'syntaxes/';

gulp.task('buildSyntax', (cb) => {
	const jsonData = jsyaml.safeLoad(fs.readFileSync(path.join(syntaxDir, syntaxFile), 'utf-8'));
	const content = JSON.stringify(jsonData);
	const outPath = path.join(syntaxDir, outSynaxFile);
	fs.writeFileSync(outPath, content);

	if (cb) {
		cb();
	}
});

gulp.watch(path.join(syntaxDir, syntaxFile), (cb) => {
	return gulp.task('buildSyntax')(cb);
});

gulp.task('default', gulp.series(['buildSyntax']));