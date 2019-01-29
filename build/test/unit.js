/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

const gulp = require('gulp');
const runSequence = require('run-sequence');

const {npm} = require('../npm.js');
npm.useScript('compile');

gulp.task('typescript_check', async () => {
    await npm.run.compile.prefix('fabric-contract-api').spawn();
    await npm.run.compile.prefix('fabric-shim').spawn();
});

gulp.task('test-prereqs', ['lint', 'typescript_check', 'protos', 'test-schema']);

gulp.task('unit-tests', async () => {
    await npm.run.prefix('fabric-contract-api').test.spawn();
    await npm.run.prefix('fabric-shim').test.spawn();
    await npm.run.prefix('fabric-shim-crypto').test.spawn();
});

// entry point for running the unit tests
// run clean-up, then the preqreqs (that has several things in parallel), then the tests
gulp.task('test-headless', (done) => {
    const tasks = [
        'clean-up', 'test-prereqs', 'unit-tests'
    ];
    runSequence(...tasks, done);
});