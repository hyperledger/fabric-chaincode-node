/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const gulp = require('gulp');
const tape = require('gulp-tape');
const tapColorize = require('tap-colorize');
const istanbul = require('gulp-istanbul');

gulp.task('instrument', function() {
	return gulp.src([
		'node_modules/fabric-shim/lib/**/*.js'])
		.pipe(istanbul())
		.pipe(istanbul.hookRequire());
});

gulp.task('test-headless', ['clean-up', 'lint', 'instrument', 'protos'], function() {
	// this is needed to avoid a problem in tape-promise with adding
	// too many listeners to the "unhandledRejection" event
	process.setMaxListeners(0);

	return gulp.src([
		'test/unit/**/*.js'
	])
		.pipe(tape({
			reporter: tapColorize()
		}))
		.pipe(istanbul.writeReports({
			reporters: ['lcov', 'json', 'text',
				'text-summary', 'cobertura']
		}));
});

