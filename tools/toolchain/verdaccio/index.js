/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const gulp = require('gulp');
const { shell: runcmds } = require('../shell/cmd');
const util = require('util');
const path = require('path');
const ip = require('ip');

// Install from the dirs for use within the development context
const installDir = (commands) =>{

    const npm_packages = [{ category: 'apis', name: 'fabric-contract-api' },
    { category: 'apis', name: 'fabric-shim-api' },
    { category: 'libraries', name: 'fabric-ledger' },
    { category: 'libraries', name: 'fabric-shim' },
    { category: 'libraries', name: 'fabric-shim-crypto' }];
  

    for (const npm_package of npm_packages) {
        const packageJSON = require(`../../../${npm_package.category}/${npm_package.name}/package.json`);
        const npm_tag = packageJSON.tag;
        const modulepath = path.resolve(`../../../${npm_package.category}/${npm_package.name}/`);
        commands.push(util.format(`npm publish --registry http://${ip.address()}:4873 %s --tag %s`, modulepath, npm_tag));
        commands.push(util.format(`npm view --registry http://${ip.address()}:4873 %s`, npm_package.name));
    }

    return commands;
}

// Install from a set of prebuild tgz for use within the pipline
const installTGZ = (commands) =>{

    const npm_packages = [{ category: 'apis', name: 'fabric-contract-api' },
    { category: 'apis', name: 'fabric-shim-api' },
    { category: 'libraries', name: 'fabric-ledger' },
    { category: 'libraries', name: 'fabric-shim' },
    { category: 'libraries', name: 'fabric-shim-crypto' }];
   

    for (const npm_package of npm_packages) {
       const packageJSON = require(`../../../${npm_package.category}/${npm_package.name}/package.json`);
       const npm_tag = packageJSON.tag;
       const name = `${npm_package.name}-${packageJSON.version}.tgz`;
       commands.push(util.format(`npm publish --registry http://${ip.address()}:4873 ../../../build/%s --tag %s`, name, npm_tag));
       commands.push(util.format(`npm view --registry http://${ip.address()}:4873 %s`, npm_package.name));
    }

    
    return commands;
}


const verdaccioStart = async () => {
    let commands = [
        'docker rm -f verdaccio || true',
        util.format('docker run -d -p 4873:4873 -v %s/config.yaml:/verdaccio/conf/config.yaml --name verdaccio verdaccio/verdaccio', __dirname),
        'sleep 5', // verdaccio takes a while to start
        `npm config delete //${ip.address()}:4873/:_authToken`,
        `npm-cli-login -u testuser -p testpass -e testuser@example.org -r http://${ip.address()}:4873`,
        'sleep 5' // avoid "jwt not active" error
    ];


    let inPipeline = process.env.PIPELINE_WORKSPACE || false;

    if (inPipeline){
        commands = installTGZ(commands);
    } else {
        commands = installDir(commands);
    }
    
    await runcmds(commands);
};

const verdaccioStop = async () => {
    const commands = [
        util.format('docker rm -f verdaccio || true')
    ];
    await runcmds(commands);
};

exports.start = verdaccioStart;
exports.stop = verdaccioStop;