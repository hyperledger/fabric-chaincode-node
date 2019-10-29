/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
/* eslint-disable no-console */
const gulp = require('gulp');
const jsdoc = require('gulp-jsdoc3');
const fs = require('fs-extra');
const path = require('path');
const replace = require('gulp-replace');
let currentBranch = process.env.SYSTEM_PULLREQUEST_TARGETBRANCH;

if (!currentBranch) {
    currentBranch = 'master';
}

let docsRoot;
if (process.env.DOCS_ROOT) {
    docsRoot = process.env.DOCS_ROOT;
} else {
    docsRoot = './_out';
}

const clean = () => {
    return fs.remove(path.join(docsRoot, currentBranch));
};

const docSrc = [
    './README.md',
    '../../libraries/fabric-shim/lib/chaincode.js',
    '../../libraries/fabric-shim/lib/stub.js',
    '../../libraries/fabric-shim/lib/iterators.js',
    '../../apis/fabric-contract-api/lib/**/*.js'
];

const jsdocs = () => {
    return gulp.src(docSrc, { read: false }).pipe(jsdoc({
        opts: {
            tutorials: './tutorials',
            destination: path.join(docsRoot, currentBranch)
        },
        templates: {
            systemName: 'Hyperledger Fabric Node.js Contract and Shim',
            theme: 'cosmo'
        },
    })
    );
}

const schemaDocs = () => {
    return gulp.src('fabric-contract-api/schema/contract-schema.json')
        .pipe(gulp.dest(path.join(docsRoot, currentBranch)));
};

// for the rare occurance where something needs to be bootsrap in the docs ahead of a release
gulp.task('bootstrap', function () {
    gulp.src('./docs/bootstrap/**/*').pipe(gulp.dest(docsRoot));
});

exports.docs = gulp.series(clean, jsdocs);