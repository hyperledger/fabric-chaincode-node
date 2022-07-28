/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

/* eslint-disable no-console*/
'use strict';

const fs = require('fs');
const git = require('git-rev-sync');
const path = require('path');
const util = require('util');

const { shell: runcmds } = require('toolchain');

const version = JSON.parse(fs.readFileSync(path.join(__dirname,'package.json'))).version;
const build_dir = path.join(__dirname);
const tag = version + '-' + git.short();

// reg exp the sort tag versions
const regex = /^(\d+\.\d+)/
const shortVersion = version.match(regex);


// build and tag the fabric-nodeenv image
const imageBuild = async () => {
    await runcmds(
        [
            util.format('docker build -t hyperledger/fabric-nodeenv:%s -f %s %s',
                tag, path.join(build_dir, 'Dockerfile'), build_dir),
            util.format('docker tag hyperledger/fabric-nodeenv:%s hyperledger/fabric-nodeenv:%s',
                tag, version),
            util.format('docker tag hyperledger/fabric-nodeenv:%s hyperledger/fabric-nodeenv:%s',
                tag, shortVersion[shortVersion.index]),
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

const main = async()=>{
    await imageClean();
    await imageBuild();
}

main().catch((e)=>{
    console.error(e);
    process.exit(1);
})
