/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const spawn = require('child_process').spawn;

// Literal Build Tool Programming
//
// Best explanation is by example:

// const {npm} = require('../npm.js');
//
// npm.useScript('compile');
//
// gulp.task('typescript_check', async () => {
//     await npm.run.compile.prefix('fabric-contract-api').spawn();
//     await npm.run.compile.prefix('fabric-shim').spawn();
// });



// A general purpose structure that can be used for any command.
// This defines the important 'spawn' command. This executes the command
// with the arguments that have been specified.
// It is set to inherit the environment variables, uses teh default sell, and inherits the
// stdio/stderr streams. (Inheriting means that the formating colour, etc is maintained)
//
// spawn() MUST be the last item chained sequence
//
// It also blanks the arguments supplied, so the instance of the cmd can be reused
// It returns a promise that is resolved when the exit code is 0, and rejected for any other code
const _cmd = {
    cmd: '',
    args: [],

    // can override the cwd
    spawn: function (cwd = process.cwd()) {
        const promise = new Promise((resolve, reject) => {
            const _name = this.toString();
            // eslint-disable-next-line no-console
            console.log(`spawning:: ${_name}`);
            const call = spawn(this.cmd, this.args, {env: process.env, shell: true, stdio: 'inherit', cwd});
            this.args = [];
            call.on('exit', (code) => {
                // eslint-disable-next-line no-console
                console.log(`spawning:: ${_name} code::${code}`);
                if (code === 0) {
                    resolve(0);
                } else {
                    reject(code);
                }
            });
            return call;
        });

        return promise;
    },
    toString: function () {
        return `${this.cmd} ${this.args.join(' ')}`;
    }
};

// Function to create a new instance of the npm command.
// This sets up the run, test, and prefix options
// If you wish to add 'scripts' eg build compile etc, the useScript()
// function can be used.
function npm () {

    // duplicate the generic cmd object
    const _npm = Object.create(_cmd);
    _npm.cmd = 'npm';

    // no-args
    const noargs = ['run', 'test'];
    noargs.forEach((m) => {
        Object.defineProperty(_npm, m, {
            get: function () {
                this.args.push(m);
                return this;
            }
        });
    });

    // single-arg fn
    ['prefix'].forEach((m) => {
        Object.defineProperty(_npm, m, {
            value: function (p) {
                this.args.push(`--${m}`, p);
                return this;
            }
        });

    });

    // function to use to add extra scripts
    //  npm.useScript('compile','build')
    _npm.useScript = (...scripts) => {
        scripts.forEach((m) => {
            Object.defineProperty(_npm, m, {
                get: function () {
                    this.args.push(m);
                    return this;
                }
            });
        });
    };

    return _npm;
}

// default export is the npm function to create instances of the npm command
module.exports = npm;

// singleton npm instance
module.exports.npm = npm();