/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

const _cmd = require('./cmd.js');


// Function to create a new instance of the npm command.
// This sets up the run, test, and prefix options
// If you wish to add 'scripts' eg build compile etc, the useScript()
// function can be used.
function npm () {

    // duplicate the generic cmd object
    const _npm = Object.create(_cmd);
    _npm.cmd = 'npm';
    _npm.args = [];

    // no-args
    const noargs = ['run', 'test', 'build', 'start', 'install'];
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
        return this;
    };

    return _npm;
}

// default export is the npm function to create instances of the npm command
module.exports = npm;
// singleton npm instance
module.exports.npm = npm();

