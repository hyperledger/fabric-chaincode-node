/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

const {lint} = require('./build/eslint');
const {protos} = require('./build/protos');
const {unittest} = require('./build/test/unit');
const {test_schema} = require('./build/schema');
const {startFabric} = require('./build/test/setup');
const {series, task} = require('gulp');
const {testfvshim} = require('./build/test/e2e');
const {testScenario} = require('./build/test/scenario');

// gulp.task('test-devmode-cli', (done) => {
//     const tasks = ['test-devmode'];
//     runSequence(...tasks, done);
// });

exports.unittest = unittest;
exports.lint = lint;
exports.test_schema = test_schema;
exports.startFabric = startFabric;
exports.fvtest = testfvshim;
exports.scenario = testScenario;
exports.protos = protos;
exports.default = series(lint, test_schema, unittest);

task('channel-init', startFabric);
task('test-headless', series(lint, test_schema, unittest));
task('test-e2e', series(testfvshim, testScenario));
// task('test-devmode', series(test-scenario-devmode));
