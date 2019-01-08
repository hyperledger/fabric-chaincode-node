/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const requireDir = require('require-dir');
const gulp = require('gulp');

// Require all tasks in gulp/tasks, including subfolders
requireDir('./build', {recurse: true});

// invoke all functions for inversion control task is moved here to avoid subfolders having to require tasks from other subfolders.
gulp.task('invokeAllFnsInvCtrl', gulp.series(
    [
        // ensure that the fabric shim in it's entirity is copied over and verdaccioed
        'st-copy-shim-crypto',
        // ensure that the fabric is setup and the chaincode has been constructed
        'st-copy-chaincode',
        // ensure that chaincode is npm installed
        'npm-install-chaincode',
        // Use the CLI to start up the chaincode
        'inv-startup-chaincode',
        // install
        'st-install_chaincode',
        // instantiate
        'st-instantiate_chaincode',
        'delay',
        // check it didn't start up a docker image but used devmode
        'check-docker',
        // invoke all functions
        'invoke_functions',
        // kill the dev mode cc
        'kill-cli'
    ]
));

gulp.task('test-invctrl', gulp.series('invokeAllFnsInvCtrl'));

// invoke all functions in dev mode task is moved here to avoid subfolders having to require tasks from other subfolders.
gulp.task('invokeAllFnsInDev', gulp.series(
    [
        // ensure that the fabric shim in it's entirity is copied over and verdaccioed
        'st-copy-shim-crypto',
        // ensure that the fabric is setup and the chaincode has been constructed
        'st-copy-chaincode',
        // Use the CLI to start up the chaincode
        'dm-startup-chaincode',
        // install
        'st-install_chaincode',
        // instantiate
        'st-instantiate_chaincode',
        'delay',
        // check it didn't start up a docker image but used devmode
        'check-docker',
        // invoke all functions
        'invoke_functions',
        // kill the dev mode cc
        'kill-cli'
    ]
));

gulp.task('test-devmode', gulp.series('invokeAllFnsInDev'));

gulp.task('default', gulp.series('lint'));

// Setup the e2e tests and sequence tests to run in sequence;
// when the control of the tests is in the scripts in this repo we could remove this.
gulp.task('test-e2e', gulp.series(['test-e2e-shim', 'test-fv-shim', 'test-scenario']));

// FAB-13462 - disabled this test temporarily pending rewrite for Fabric v2.0 changes.
// gulp.task('test-devmode-cli', (done) => {
//     const tasks = ['test-devmode'];
//     runSequence(...tasks, done);
// });

// FAB-13462 - disabled this test temporarily pending rewrite for Fabric v2.0 changes.
// gulp.task('test-invctrl-cli', (done) => {
//     const tasks = ['test-invctrl'];
//     runSequence(...tasks, done);
// });
