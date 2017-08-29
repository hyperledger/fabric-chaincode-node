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
		'!src/node_modules/**',
		'!test/node_modules/**',
		'!coverage/**'
	], {
		base: path.join(__dirname, '..')
	}).pipe(eslint(
		{
			env: ['es6', 'node'],
			extends: 'eslint:recommended',
			parserOptions: {
				sourceType: 'module',
				ecmaVersion: 8,
			},
			rules: {
				indent: ['error', 'tab'],
				'linebreak-style': ['error', 'unix'],
				quotes: ['error', 'single'],
				semi: ['error', 'always'],
				'no-trailing-spaces': ['error'],
				'max-len': [
					'error',
					{
						'code': 150,
						'ignoreTrailingComments': true,
						'ignoreUrls': true,
						'ignoreStrings': true,
						'ignoreTemplateLiterals': true,
						'ignoreRegExpLiterals': true
					}
				]
			}
		}
	)).pipe(eslint.format()).pipe(eslint.failAfterError());
});
