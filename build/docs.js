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

let docSrc = [
	'docs/README.md',
	'fabric-shim/lib/chaincode.js',
	'fabric-shim/lib/stub.js',
	'fabric-shim/lib/iterators.js',
	'fabric-contract-api/lib/**/*.js'
	// 'fabric-contract-api/index.js',
	// 'fabric-shim/index.js'
];

gulp.task('docs', ['clean'], function (cb) {
	gulp.src(docSrc, { read: false }).pipe(
		jsdoc({
			opts: {
				tutorials: './docs/tutorials',
				destination: './docs/gen'
			},
			templates: {
				systemName: 'Hyperledger Fabric Contract API and Shim for node.js chaincode',
				theme: 'cosmo'
			}
		},cb)
	);
});

gulp.task('docs-dev',['docs'], function(){
	gulp.watch(docSrc,['docs']);

});
