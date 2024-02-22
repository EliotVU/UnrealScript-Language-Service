// TODO: Deprecate usage of gulpjs altogether.

const gulp = require('gulp');
const path = require('path');
const { exec } = require('child_process');

const SYNTAX_TASK = (function () {
    const TASK_NAME = 'compileSyntax';

    const dir = 'syntaxes/';
    const languagePath = path.join(dir, 'UnrealScript.YAML-tmLanguage');
    const ppLanguagePath = path.join(dir, 'unrealscript.preprocessor.YAML-tmLanguage');

    gulp.task(TASK_NAME, (done) => {
        // We could use js-yaml directly, but I would prefer to deprecate gulpjs altogether instead.
        exec('npm run compile:syntax', (err, stdout, stderr) => {
            console.log(stdout);
            console.error(stderr);
            done();
        });
    });

    if (process.env.NODE_ENV === 'development') {
        const FILES_TO_WATCH = [ppLanguagePath, languagePath];
        gulp.watch(FILES_TO_WATCH, (cb) => {
            return gulp.task(TASK_NAME)(cb);
        });
    }
    
    return TASK_NAME;
})();

const GRAMMAR_TASK = (function () {
    const TASK_NAME = 'buildGrammar';

    const dir = 'grammars/';
    const lexerPath = path.join(dir, 'UCLexer.g4');
    const parserPath = path.join(dir, 'UCParser.g4');
    const ppParserPath = path.join(dir, 'UCPreprocessorParser.g4');

    gulp.task(TASK_NAME, (done) => {
        /* `cd node_modules/antlr4ts-cli && antlr4ts -visitor ${GRAMMAR_PATH} -o server/src/antlr` */
        exec('npm run compile:grammar', (err, stdout, stderr) => {
            console.log(stdout);
            console.error(stderr);
            done();
        });

        exec('npm run compile:preprocessor', (err, stdout, stderr) => {
            console.log(stdout);
            console.error(stderr);
            done();
        });
    });

    if (process.env.NODE_ENV === 'development') {
        const FILES_TO_WATCH = [lexerPath, parserPath, ppParserPath];
        gulp.watch(FILES_TO_WATCH, (cb) => {
            return gulp.task(TASK_NAME)(cb);
        });
    }

    return TASK_NAME;
})();

gulp.task('default', gulp.series([GRAMMAR_TASK, SYNTAX_TASK]));
