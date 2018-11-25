/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

/* eslint-disable no-console*/
'use strict';

const fs = require('fs');
const git = require('git-rev-sync');
const gulp = require('gulp');
const path = require('path');
const shell = require('gulp-shell');
const util = require('util');

const version = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'))).version;
const node_version = process.env.NODE_VERSION || '8';
const build_dir = path.join(__dirname, '..', 'fabric-nodeenv');
const tag = version + '-' + git.short();

// build and tag the fabric-nodeenv image
gulp.task('docker-image-build', () => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([
            util.format('docker build --build-arg NODE_VER=%s -t hyperledger/fabric-nodeenv:%s -f %s %s',
                node_version, tag, path.join(build_dir, 'Dockerfile'), build_dir),
            util.format('docker tag hyperledger/fabric-nodeenv:%s hyperledger/fabric-nodeenv:%s',
                tag, version),
            util.format('docker tag hyperledger/fabric-nodeenv:%s hyperledger/fabric-nodeenv:latest', tag)
        ]));
});

// remove fabric-nodeenv images
gulp.task('docker-image-clean', () => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([
            util.format('docker rmi -f `docker images -q --filter=reference="hyperledger/fabric-nodeenv:%s*"`', version)
        ]));
});

