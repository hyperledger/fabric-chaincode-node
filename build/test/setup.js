/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';
/* eslint-disable no-console*/
const {series, src, dest} = require('gulp');
const util = require('util');
const fs = require('fs-extra');
const path = require('path');
const shell = require('gulp-shell');
const rename = require('gulp-rename');

const version = require(path.join(__dirname, '../../package.json')).version;
// const replace = require('gulp-replace');
// const runSequence = require('run-sequence');
const merge = require('merge-stream');
const delay = require('delay');
const getTLSArgs = require('./utils').getTLSArgs;

const {shell: runcmds} = require('./../shell/cmd');


const networkDir = path.join(__dirname, 'network');
const dockerComposeDir = path.join(networkDir, 'docker-compose');
const dockerCfgPath = '/etc/hyperledger/config';
const dockerCfgTxPath = '/etc/hyperledger/configtx';
const channelName = 'mychannel';
const tls = require('./utils').tls;
// const version = require(path.join(__dirname, '../../package.json')).version;
const arch = process.arch;
const release = require(path.join(__dirname, '../../package.json')).testFabricVersion;
const thirdparty_release = require(path.join(__dirname, '../../package.json')).testFabricThirdParty;

let dockerImageTag = '';
let thirdpartyImageTag = '';
let docker_arch = '';

// this is a release build, need to build the proper docker image tag
// to run the tests against the corresponding fabric released docker images
if (arch.indexOf('x64') === 0) {
    docker_arch = ':amd64';
} else if (arch.indexOf('s390') === 0) {
    docker_arch = ':s390x';
} else if (arch.indexOf('ppc64') === 0) {
    docker_arch = ':ppc64le';
} else {
    throw new Error('Unknown architecture: ' + arch);
}

// release check, if master is specified then we are using a fabric that has been
// built from source, otherwise we are using specific published versions.

// prepare thirdpartyImageTag (currently using couchdb image in tests)
if (!/master/.test(thirdparty_release)) {
    thirdpartyImageTag = docker_arch + '-' + thirdparty_release;
}
if (!/master/.test(release)) {
    dockerImageTag = docker_arch + '-' + release;
}
// these environment variables would be read at test/fixtures/docker-compose.yaml
process.env.DOCKER_IMG_TAG = dockerImageTag;
process.env.THIRDPARTY_IMG_TAG = thirdpartyImageTag;
process.env.DOCKER_DEVMODE = process.env.DEVMODE ? process.env.DEVMODE : 'true';
// // by default for running the tests print debug to a file
// const debugPath = path.join(constants.tempdir, 'logs/test-debug.log');
// console.log('\n####################################################');
// console.log(util.format('# debug log: %s', debugPath));
// console.log('####################################################\n');

// function clean_up () {
//     // some tests create temporary files or directories
//     // they are all created in the same temp folder
//     fs.removeSync(constants.tempdir);
//     return fs.ensureFileSync(debugPath);
// }

function _clean_up_chaincode () {
    return src('*.js', {read: false})
        .pipe(shell([
            'find . -name "fabric*.tgz" -depth -exec rm {} \\;',
            'find test -name "node_modules" -depth -exec rm -r {} \\;'
        ]));
}

// This and other usage of the gulp-shell module cannot use the
// short-hand style because we must delay the use of the testDir
// to task invocation time, rather than module load time (which
// using the short-hand style will cause), because the testDir
// is not defined until the 'clean-up' task has been run
function _docker_clean () {
    return src('*.js', {read: false})
        .pipe(shell([
            // stop and remove chaincode docker instances
            'docker kill $(docker ps | grep "dev-peer0.org[12].example.com" | awk \'{print $1}\')',
            'docker rm $(docker ps -a | grep "dev-peer0.org[12].example.com" | awk \'{print $1}\')',

            // remove chaincode images so that they get rebuilt during test
            'docker rmi $(docker images | grep "^dev-peer0.org[12].example.com" | awk \'{print $3}\')',

            // clean up all the containers created by docker-compose
            util.format('docker-compose -f %s down --volumes', fs.realpathSync(path.join(dockerComposeDir, 'docker-compose-cli.yaml'))),
            util.format('docker-compose -f %s -p node down --volumes', fs.realpathSync(path.join(dockerComposeDir, 'docker-compose.yaml'))),
            util.format('docker-compose -f %s -p node down --volumes', fs.realpathSync(path.join(dockerComposeDir, 'docker-compose-tls.yaml')))
        ], {
            verbose: true, // so we can see the docker command output
            ignoreErrors: true // kill and rm may fail because the containers may have been cleaned up
        }));

}

function _docker_cli_ready () {
    return src('*.js', {read: false})
        .pipe(shell([
            // make sure that necessary containers are up by docker-compose
            util.format('docker-compose -f %s up -d', fs.realpathSync(path.join(dockerComposeDir, 'docker-compose-cli.yaml'))),
        ]));
}

const cliReady = series(_clean_up_chaincode, _docker_clean, _docker_cli_ready);
// --

function _generate_config () {
    return src('*.js', {read: false})
        .pipe(shell([
            util.format(
                'docker exec cli rm -rf %s/crypto-config',
                dockerCfgPath
            ),
            util.format(
                'docker exec cli rm -f %s/channel.tx',
                dockerCfgPath
            ),
            util.format(
                'docker exec cli rm -f %s/core.yaml',
                dockerCfgPath
            ),
            util.format(
                'docker exec cli rm -f %s/genesis.block',
                dockerCfgPath
            ),
            util.format(
                'docker exec cli rm -f %s/mychannel.block',
                dockerCfgPath
            ),
            util.format(
                'docker exec cli cryptogen generate --config=%s/crypto-config.yaml --output %s/crypto-config',
                dockerCfgPath,
                dockerCfgPath
            ),
            util.format(
                'docker exec cli configtxgen -profile TwoOrgsOrdererGenesis -outputBlock %s/genesis.block -channelID not%s',
                dockerCfgPath,
                channelName
            ),
            util.format(
                'docker exec cli configtxgen -profile TwoOrgsChannel -outputCreateChannelTx %s/channel.tx -channelID %s',
                dockerCfgPath,
                channelName
            ),
            util.format(
                'docker exec cli cp /etc/hyperledger/fabric/core.yaml %s',
                dockerCfgPath
            ),
            util.format(
                'docker exec cli sh %s/rename_sk.sh',
                dockerCfgPath
            ),
            util.format(
                'docker-compose -f %s down',
                fs.realpathSync(path.join(dockerComposeDir, 'docker-compose-cli.yaml'))
            )
        ], {
            verbose: true, // so we can see the docker command output
            ignoreErrors: true // kill and rm may fail because the containers may have been cleaned up
        }));

}

const generateConfig = series(cliReady, _generate_config);

// --
// variable to construct the docker network name used by
// chaincode container to find peer node
process.env.COMPOSE_PROJECT_NAME = 'basicnetwork';
function _start_docker () {
    const composeFile = tls ? 'docker-compose-tls.yaml' : 'docker-compose.yaml';

    console.log(`################\nUsing docker compose file: ${composeFile}\n################`); // eslint-disable-line no-console

    return src('*.js', {read: false})
        .pipe(shell([
            // make sure that necessary containers are up by docker-compose
            util.format('docker-compose -f %s -p node up -d', fs.realpathSync(path.join(dockerComposeDir, composeFile))),
            'docker exec -d logging sh -c \'wget -q -O /logs/docker.log http://127.0.0.1:80/logs\''
        ]));
}

const dockerReady = series(generateConfig, _start_docker);

// --
async function _channel_init () {
    await runcmds([
        // create channel, join peer0 to the channel
        'docker exec org1_cli /etc/hyperledger/fixtures/channel-init.sh',
        'docker exec org2_cli /etc/hyperledger/fixtures/channel-init.sh'
    ]);
}

async function _channel_create () {
    await delay(3000);
    await runcmds([
        util.format(
            'docker exec org1_cli peer channel create -o orderer.example.com:7050 -c %s -f %s/channel.tx --outputBlock %s/mychannel.block %s',
            channelName,
            dockerCfgTxPath,
            dockerCfgTxPath,
            channelName,
            getTLSArgs()
        )
    ]);
}

const localPublish = async () => {
    await runcmds([
        util.format('npm pack %s', path.join(__dirname, '../../fabric-contract-api')),
        util.format('npm pack %s', path.join(__dirname, '../../fabric-shim')),
        util.format('npm pack %s', path.join(__dirname, '../../fabric-shim-crypto'))
    ]);
};

const copyPublishedToChaincode = () => {

    const streams = [];

    // Copy to fv tests
    const fvPath = path.join(__dirname, '../../test/fv');

    let dirContents = fs.readdirSync(fvPath);
    dirContents = dirContents.filter(c => c.match(/.*.js/) && c !== 'utils.js');

    const chaincodeNames = dirContents.map(n => n.replace('.js', ''));
    for (const c in chaincodeNames) {
        const name = chaincodeNames[c];
        const directory = `test/fv/${name}`;

        fs.ensureDirSync(path.join(fvPath, name));

        const stream = src([
            path.join(process.cwd(), `fabric-contract-api-${version}.tgz`),
            path.join(process.cwd(), `fabric-shim-${version}.tgz`),
            path.join(process.cwd(), `fabric-shim-crypto-${version}.tgz`),
        ])
            .pipe(rename(function(filename) {
                filename.basename = filename.basename.replace(`-${version}`, '');
            }))
            .pipe(dest(directory));
        streams.push(stream);
    }

    // copy to scenario test
    const stream = src([
        path.join(process.cwd(), `fabric-contract-api-${version}.tgz`),
        path.join(process.cwd(), `fabric-shim-${version}.tgz`),
        path.join(process.cwd(), `fabric-shim-crypto-${version}.tgz`),
    ])
        .pipe(rename(function(filename) {
            filename.basename = filename.basename.replace(`-${version}`, '');
        }))
        .pipe(dest(path.join(__dirname, '../../test/scenario')));

    streams.push(stream);

    return merge(...streams);
};



const channelSetup = series(_channel_create, _channel_init);

// --
const startFabric = series(dockerReady, channelSetup, localPublish, copyPublishedToChaincode);
exports.startFabric = startFabric;
