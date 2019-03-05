const gulp = require('gulp');
const path = require('path');

gulp.task('test-fv-shim', gulp.series((done) => {
    const dir = path.join(__dirname, '../../test/fv');

    const {spawn} = require('child_process');
    const cmd = spawn('npx', ['mocha', '--recursive', dir], {shell:true, cwd:process.cwd(), env:process.env});

    cmd.stdout.on('data', (data) => {
        process.stdout.write(`${data}`);
    });

    cmd.stderr.on('data', (data) => {
        process.stdout.write(`${data}`);
    });

    cmd.on('close', (code) => {
        if (code !== 0) {
            done(new Error(`child process exited with code ${code}`));
        } else {
            console.log(`child process exited with code ${code}`); // eslint-disable-line no-console
            done();
        }
    });

}));