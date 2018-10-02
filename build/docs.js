/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

var gulp = require('gulp');
var jsdoc = require('gulp-jsdoc3');
var fs = require('fs-extra');
const path=require('path');
let currentBranch=process.env.GERRIT_BRANCH;

if (!currentBranch){
	console.error('GERRIT_BRANCH needs to be set');
	process.exit(1);
}

let docsRoot;
if (process.env.DOCS_ROOT){
	docsRoot = process.env.DOCS_ROOT;
} else {
	docsRoot = './docs/gen';
}

gulp.task('clean', function(){
	return fs.removeSync(path.join(docsRoot,currentBranch));
});

gulp.task('docs', ['clean'], function () {
	gulp.src([
		'src/README.md',
		'src/lib/**/*.js'
	], { read: false }).pipe(
		jsdoc({
			opts: {
				tutorials: './docs/tutorials',
				destination: path.join(docsRoot,currentBranch)
			},
			templates: {
				systemName: 'Hyperledger Fabric Shim for node.js chaincode',
				theme: 'cosmo' //cerulean, cosmo, cyborg, flatly, journal, lumen, paper, readable, sandstone, simplex, slate, spacelab, superhero, united, yeti
			}
		})
	);
});
