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
const {docs} = require('./build/docs');

// gulp.task('test-devmode-cli', (done) => {
//     const tasks = ['test-devmode'];
//     runSequence(...tasks, done);
// });


exports.lint = lint;
exports.test_schema = test_schema;
exports.startFabric = startFabric;
exports.fvtest = testfvshim;
exports.scenario = testScenario;
exports.docs = docs;
exports.default = series(lint, protos, test_schema, unittest);

// backward compatable names for the Jenkins build
task('channel-init', startFabric);
task('test-headless', series(lint, protos, test_schema, unittest));
task('test-e2e', series(testfvshim, testScenario));
// task('test-devmode', series(test-scenario-devmode));
