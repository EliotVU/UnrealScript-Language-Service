const gulp = require('gulp');
const path = require('path');
const { exec } = require('child_process');

const GRAMMAR_Dir = 'grammars/';

const GRAMMAR_PATH = path.join(GRAMMAR_Dir, 'UCParser.g4');
const GRAMMAR_PATH2 = path.join(GRAMMAR_Dir, 'UCLexer.g4');
const GRAMMAR_PATH3 = path.join(GRAMMAR_Dir, 'UCPreprocessorParser.g4');

const GRAMMAR_TASK = (function () {
    const TASK_NAME = 'buildGrammar';

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
        const FILES_TO_WATCH = [GRAMMAR_PATH, GRAMMAR_PATH2, GRAMMAR_PATH3];
        gulp.watch(FILES_TO_WATCH, (cb) => {
            return gulp.task(TASK_NAME)(cb);
        });
    }
    return TASK_NAME;
})();

gulp.task('default', gulp.series([GRAMMAR_TASK]));