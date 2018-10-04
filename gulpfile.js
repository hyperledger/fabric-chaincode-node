/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const requireDir = require('require-dir');
const gulp = require('gulp');
const runSequence = require('run-sequence');

// Require all tasks in gulp/tasks, including subfolders
requireDir('./build', { recurse: true });

gulp.task('default', ['lint'], function () {
	// This will only run if the lint task is successful...
});

// Setup the e2e tests and sequence tests to run in sequence;
// when the control of the tests is in the scripts in this repo we could remove this.
gulp.task('test-e2e',(done)=>{
	const tasks = [
		'test-e2e-shim','test-scenario'
	];
	runSequence(...tasks,done);
});

gulp.task('test-devmode-cli',(done)=>{
	const tasks = [
		'test-devmode'
	];
	runSequence(...tasks,done);
});
