/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const requireDir = require('require-dir');
const gulp = require('gulp');

// Require all tasks in gulp/tasks, including subfolders
requireDir('./build', {recurse: true});

gulp.task('test-invctrl', gulp.series('test-scenario-invctrl'));

gulp.task('test-devmode', gulp.series('test-scenario-devmode'));

gulp.task('default', gulp.series('lint'));

// Setup the e2e tests and sequence tests to run in sequence;
// when the control of the tests is in the scripts in this repo we could remove this.
gulp.task('test-e2e', gulp.series(['test-fv-shim', 'test-scenario']));