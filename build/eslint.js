/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const gulp = require('gulp');
const eslint = require('gulp-eslint');
const path = require('path');

gulp.task('lint', function () {
    return gulp.src([
        '**/*.js',
        '!fabric-contract-api/node_modules/**',
        '!fabric-shim/node_modules/**',
        '!test/node_modules/**',
        '!**/typescript/*.js',
        '!coverage/**',
        '!docs/**'
    ], {
        base: path.join(__dirname, '..')
    }).pipe(eslint()).pipe(eslint.format()).pipe(eslint.failAfterError());
});
