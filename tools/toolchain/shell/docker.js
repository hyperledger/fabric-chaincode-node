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
function docker () {

    // duplicate the generic cmd object
    const _docker = Object.create(_cmd);
    _docker.cmd = 'docker';
    _docker.args = [];

    // function to use to add extra scripts
    //  npm.useScript('compile','build')
    _docker.useScript = (...scripts) => {
        scripts.forEach((m) => {
            Object.defineProperty(_docker, m, {
                get: function () {
                    this.args.push(m);
                    return this;
                }
            });
        });
        return this;
    };

    return _docker;
}

// default export is the npm function to create instances of the npm command
module.exports = docker;
