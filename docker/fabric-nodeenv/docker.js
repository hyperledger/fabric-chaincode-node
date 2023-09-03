/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

/* eslint-disable no-console*/
'use strict';

const fs = require('node:fs');
const git = require('git-rev-sync');
const path = require('node:path');
const { execSync } = require('node:child_process');
const process = require('node:process');

const version = JSON.parse(fs.readFileSync(path.join(__dirname,'package.json'))).version;
const build_dir = path.join(__dirname);
const tag = version + '-' + git.short();
const imageName = 'hyperledger/fabric-nodeenv'

// reg exp the sort tag versions
const regex = /^(\d+\.\d+)/
const shortVersion = version.match(regex);

function runCmd(command) {
    console.log(command);
    execSync(command, {
        stdio: 'inherit',
    });
}

// build and tag the fabric-nodeenv image
function imageBuild() {
    runCmd(`docker build -t ${imageName}:${tag} -f ${path.join(build_dir, 'Dockerfile')} ${build_dir} 2>&1`);
    runCmd(`docker tag ${imageName}:${tag} ${imageName}:${version}`);
    runCmd(`docker tag ${imageName}:${tag} ${imageName}:${shortVersion[shortVersion.index]}`);
    runCmd(`docker tag ${imageName}:${tag} ${imageName}:latest`);
};

// remove fabric-nodeenv images
function imageClean() {
    runCmd(`docker images -q --filter=reference="${imageName}:${version}*" | uniq | xargs -r docker rmi -f`);
};

try {
    imageClean();
    imageBuild();
} catch (e) {
    console.error(e);
    process.exitCode = 1;
}
