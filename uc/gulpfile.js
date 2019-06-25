const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const jsyaml = require('js-yaml');

const SYNTAX_TASK = (function(){
	const TASK_NAME = 'buildSyntax';

	const SYNTAX_FILE = 'UnrealScript.YAML-tmLanguage';
	const OUT_SYNTAX_FILE = 'UnrealScript.tmLanguage.json';
	const SYNTAX_DIR = 'syntaxes/';

	gulp.task(TASK_NAME, (cb) => {
		const jsonData = jsyaml.safeLoad(fs.readFileSync(path.join(SYNTAX_DIR, SYNTAX_FILE), 'utf-8'));
		const content = JSON.stringify(jsonData);
		const outPath = path.join(SYNTAX_DIR, OUT_SYNTAX_FILE);
		fs.writeFileSync(outPath, content);

		if (cb) {
			cb();
		}
	});

	gulp.watch(path.join(SYNTAX_DIR, SYNTAX_FILE), (cb) => {
		return gulp.task(TASK_NAME)(cb);
	});

	return TASK_NAME;
})();

const GRAMMAR_TASK = (function(){
	const TASK_NAME = 'buildGrammar';

	const GRAMMAR_File = 'UCGrammar.g4';
	const GRAMMAR_Dir = 'grammars/';
	const GRAMMAR_PATH = path.join(GRAMMAR_Dir, GRAMMAR_File);

	const GRAMMAR_File2 = 'UCLexer.g4';
	const GRAMMAR_Dir2 = 'grammars/';
	const GRAMMAR_PATH2 = path.join(GRAMMAR_Dir2, GRAMMAR_File2);

	gulp.task(TASK_NAME, (done) => {
		var exec = require('child_process').exec;
		/* `cd node_modules/antlr4ts-cli && antlr4ts -visitor ${GRAMMAR_PATH} -o server/src/antlr` */
		exec('npm run compile:grammar', (err, stdout, stderr) => {
			console.log(stdout);
			console.error(stderr);
			done(err || stderr);
		});
	});

	gulp.watch([GRAMMAR_PATH, GRAMMAR_PATH2], (cb) => {
		return gulp.task(TASK_NAME)(cb);
	});

	return TASK_NAME;
})();

gulp.task('default', gulp.series([SYNTAX_TASK, GRAMMAR_TASK]));