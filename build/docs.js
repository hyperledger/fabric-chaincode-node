/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

var gulp = require('gulp');
var jsdoc = require('gulp-jsdoc3');
var fs = require('fs-extra');

gulp.task('clean', function(){
	return fs.removeSync('./docs/gen/**');
});

gulp.task('docs', ['clean'], function () {
	gulp.src([
		'src/README.md',
		'src/lib/**/*.js'
	], { read: false }).pipe(
		jsdoc({
			opts: {
				tutorials: './docs/tutorials',
				destination: './docs/gen'
			},
			templates: {
				systemName: 'Hyperledger Fabric Shim for node.js chaincode',
				theme: 'cosmo' //cerulean, cosmo, cyborg, flatly, journal, lumen, paper, readable, sandstone, simplex, slate, spacelab, superhero, united, yeti
			}
		})
	);
});
