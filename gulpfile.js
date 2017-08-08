/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const requireDir = require('require-dir');
const gulp = require('gulp');

// Require all tasks in gulp/tasks, including subfolders
requireDir('./build', { recurse: true });

gulp.task('default', ['lint'], function () {
	// This will only run if the lint task is successful...
});
