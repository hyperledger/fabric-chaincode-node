/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const gulp = require('gulp');
const shell = require('gulp-shell');
const util = require('util');

gulp.task('verdaccio-start', () => {
    const commands = [
        'docker rm -f verdaccio || true',
        util.format('docker run -d -p 4873:4873 -v %s/config.yaml:/verdaccio/conf/config.yaml --name verdaccio verdaccio/verdaccio', __dirname),
        'sleep 5', // verdaccio takes a while to start
        'npm config delete //localhost:4873/:_authToken',
        'npm-cli-login -u testuser -p testpass -e testuser@example.org -r http://localhost:4873',
        'sleep 5' // avoid "jwt not active" error
    ];
    const npm_packages = ['fabric-contract-api', 'fabric-shim', 'fabric-shim-crypto'];
    for (const npm_package of npm_packages) {
        const packageJSON = require(`../../${npm_package}/package.json`);
        const npm_tag = packageJSON.tag;
        commands.push(util.format('npm publish --registry http://localhost:4873 %s --tag %s', npm_package, npm_tag));
        commands.push(util.format('npm view --registry http://localhost:4873 %s', npm_package));
    }
    return gulp.src('*.js', {read: false})
        .pipe(shell(commands));
});

gulp.task('verdaccio-stop', () => {
    const commands = [
        util.format('docker rm -f verdaccio || true')
    ];
    return gulp.src('*.js', {read: false})
        .pipe(shell(commands));
});