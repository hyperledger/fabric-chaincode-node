/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

/* eslint-disable no-console*/
'use strict';

const fs = require('fs');
const git = require('git-rev-sync');
const { series } = require('gulp');
const path = require('path');
const util = require('util');

const { shell: runcmds } = require('toolchain');

const version = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'))).version;
const node_version = process.env.NODE_VERSION || '12.16.1';
const build_dir = path.join(__dirname);
const tag = version + '-' + git.short();

// build and tag the fabric-nodeenv image
const imageBuild = async () => {
    await runcmds(
        [
            util.format('docker build --build-arg NODE_VER=%s -t hyperledger/fabric-nodeenv:%s -f %s %s',
                node_version, tag, path.join(build_dir, 'Dockerfile'), build_dir),
            util.format('docker tag hyperledger/fabric-nodeenv:%s hyperledger/fabric-nodeenv:%s',
                tag, version),
            util.format('docker tag hyperledger/fabric-nodeenv:%s hyperledger/fabric-nodeenv:latest', tag)
        ]

    );
};

// remove fabric-nodeenv images
const imageClean = async () => {
    await runcmds([
        util.format('docker rmi -f `docker images -q --filter=reference="hyperledger/fabric-nodeenv:%s*"` 2>&1 || true', version)
    ]);
};

exports.default = series(imageClean, imageBuild);