/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const gulp = require('gulp'),
	watch = require('gulp-watch'),
	debug = require('gulp-debug'),
	path = require('path'),
	protos = require('./protos.js');

const baseDir = path.join(__dirname, '../src');

gulp.task('watch', function () {
	watch([
		path.join(baseDir, 'index.js'),
		path.join(baseDir, 'lib/**/*')
	], {
		ignoreInitial: false, base: baseDir
	}).pipe(
		debug()
	).pipe(
		gulp.dest(path.join(__dirname, '../node_modules/fabric-shim'))
	);
});
