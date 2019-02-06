/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';
/* eslint-disable no-console*/
const gulp = require('gulp');
const del = require('del');
const util = require('util');
const fs = require('fs-extra');
const path = require('path');
const shell = require('gulp-shell');
const execSync = require('child_process').execSync;
const replace = require('gulp-replace');
const merge = require('merge-stream');

const constants = require('../../test/constants.js');

const arch = process.arch;
const release = require(path.join(__dirname, '../../package.json')).testFabricVersion;
const thirdparty_release = require(path.join(__dirname, '../../package.json')).testFabricThirdParty;
const version = require(path.join(__dirname, '../../package.json')).version;
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

// by default for running the tests print debug to a file
const debugPath = path.join(constants.tempdir, 'logs/test-debug.log');
console.log('\n####################################################');
console.log(util.format('# debug log: %s', debugPath));
console.log('####################################################\n');

gulp.task('clean-up', async() => {
    // some tests create temporary files or directories
    // they are all created in the same temp folder

    try {
        const tmpFiles = fs.readdirSync(constants.tempdir);

        tmpFiles.forEach((el) => {
            try {
                fs.removeSync(path.join(constants.tempdir, el));
            } catch (err) {
                console.log('FAILED TO REMOVE -> ', path.join(constants.tempdir, el));
            }
        });
    } catch (err) {
        // directory does not exist
    }

    return await fs.ensureFile(debugPath);
});

// re-use the "basic-network" artifacts from fabric-samples
// by copying them to the temp folder and override the
// docker-compose.yml's content to fit the needs of the test environment
const samplesPath = constants.BasicNetworkSamplePath;
const testDir = constants.BasicNetworkTestDir;
console.log('\n####################################################');
console.log('BasicNetworkSamplePath: %s', samplesPath);
console.log('BasicNetworkTestDir: %s', testDir);
console.log('####################################################\n');

const devmode = process.env.DEVMODE ? process.env.DEVMODE : 'true';
const tls = process.env.TLS ? process.env.TLS : 'false';

gulp.task('docker-copy', gulp.series('clean-up', function() {
    gulp.src([
        path.join(__dirname, 'docker-compose.yml'),
    ], {base: __dirname})
        .pipe(replace(
            'command: peer node start',
            util.format('command: peer node start --peer-chaincodedev=%s', devmode)))
        .pipe(replace(
            'FABRIC_CA_SERVER_TLS_ENABLED=true',
            util.format('FABRIC_CA_SERVER_TLS_ENABLED=%s', tls)))
        .pipe(replace(
            'ORDERER_GENERAL_TLS_ENABLED=true',
            util.format('ORDERER_GENERAL_TLS_ENABLED=%s', tls)))
        .pipe(replace(
            'CORE_PEER_TLS_ENABLED=true',
            util.format('CORE_PEER_TLS_ENABLED=%s', tls)))
        .pipe(gulp.dest(testDir));

    gulp.src([
        path.join(samplesPath, 'configtx.yaml'),
        path.join(samplesPath, 'config'), // copy the empty folder only
        path.join(samplesPath, 'crypto-config/**'),
        path.join(samplesPath, '../chaincode'), // copy the empty folder only
    ], {base: samplesPath})
        .pipe(gulp.dest(testDir));

    return gulp.src([
        'test/fixtures/channel-init.sh',
    ])
        .pipe(gulp.dest(testDir));

}));

gulp.task('fv-copy-depts', () => {
    let dirContents = fs.readdirSync('test/fv');
    dirContents = dirContents.filter(c => c.match(/.*.js/) && c !== 'utils.js');
    const chaincodeNames = dirContents.map(n => n.replace('.js', ''));
    const streams = [];
    for (const c in chaincodeNames) {
        const name = chaincodeNames[c];
        const directory =  `test/fv/${name}`;
        fs.ensureDirSync(path.join(testDir, 'test', name));
        const stream = gulp.src([
            path.join(__dirname, `../../fabric-contract-api-${version}.tgz`),
            path.join(__dirname, `../../fabric-shim-${version}.tgz`),
            path.join(__dirname, `../../fabric-shim-crypto-${version}.tgz`),
        ])
            .pipe(gulp.dest(directory));
        streams.push(stream);
    }

    return merge(...streams);
});

gulp.task('fv-copy', gulp.series('fv-copy-depts', () => {
    return gulp.src([
        'test/fv/**/*',
    ], {base: 'test'})
        .pipe(gulp.dest(testDir));
}));

gulp.task('fv-pack', (done) => {
    const contractAPI = execSync('npm pack ./fabric-contract-api');
    const tempFabShim = constants.tempdir + '/fabric-shim';

    execSync(`cp -a fabric-shim/. ${tempFabShim}/`);
    const shimPackageJSON = JSON.parse(fs.readFileSync(tempFabShim + '/package.json'));
    shimPackageJSON.dependencies['fabric-contract-api'] = 'file:' + contractAPI.toString().trim();
    fs.writeFileSync(tempFabShim + '/package.json', JSON.stringify(shimPackageJSON));

    execSync('npm pack ' + constants.tempdir + '/fabric-shim; npm pack ./fabric-shim-crypto');

    done();
});

gulp.task('fv-clean', () => {
    return del(path.join(__dirname, '../../**/*.tgz'));
});

gulp.task('fv-pre-test', gulp.series(['fv-pack', 'fv-copy', 'fv-clean']));

gulp.task('test-fv-shim', gulp.series('fv-pre-test', (done) => {
    const dir = path.join(__dirname, '../../test/fv');

    const {spawn} = require('child_process');
    const cmd = spawn('npx', ['mocha', '--recursive', dir], {shell:true, cwd:process.cwd(), env:process.env});

    cmd.stdout.on('data', (data) => {
        process.stdout.write(`${data}`);
    });

    cmd.stderr.on('data', (data) => {
        process.stdout.write(`${data}`);
    });

    cmd.on('close', (code) => {
        if (code !== 0) {
            done(new Error(`child process exited with code ${code}`));
        } else {
            console.log(`child process exited with code ${code}`);
            done();
        }
    });

}));

// This and other usage of the gulp-shell module cannot use the
// short-hand style because we must delay the use of the testDir
// to task invocation time, rather than module load time (which
// using the short-hand style will cause), because the testDir
// is not defined until the 'clean-up' task has been run
gulp.task('docker-clean', gulp.series('docker-copy', () => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([
            // stop and remove chaincode docker instances
            'docker kill $(docker ps | grep "dev-peer0.org[12].example.com" | awk \'{print $1}\')',
            'docker rm $(docker ps -a | grep "dev-peer0.org[12].example.com" | awk \'{print $1}\')',

            // remove chaincode images so that they get rebuilt during test
            'docker rmi $(docker images | grep "^dev-peer0.org[12].example.com" | awk \'{print $3}\')',

            // clean up all the containers created by docker-compose
            util.format('docker-compose -f %s down', fs.realpathSync(path.join(testDir, 'docker-compose.yml')))
        ], {
            verbose: true, // so we can see the docker command output
            ignoreErrors: true // kill and rm may fail because the containers may have been cleaned up
        }));
}));

gulp.task('docker-cli-ready', gulp.series('docker-clean', () => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([
            // make sure that necessary containers are up by docker-compose
            util.format('docker-compose -f %s up -d cli', fs.realpathSync(path.join(testDir, 'docker-compose.yml')))
        ]));
}));

gulp.task('generate-config', gulp.series('docker-cli-ready', () => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([
            util.format('docker exec cli configtxgen -profile OneOrgOrdererGenesis -outputBlock %s',
                '/etc/hyperledger/configtx/genesis.block'),
            util.format('docker exec cli configtxgen -profile OneOrgChannel -outputCreateChannelTx %s -channelID mychannel',
                '/etc/hyperledger/configtx/channel.tx'),
            'docker exec cli cp /etc/hyperledger/fabric/core.yaml /etc/hyperledger/config/'
        ], {
            verbose: true, // so we can see the docker command output
            ignoreErrors: true // kill and rm may fail because the containers may have been cleaned up
        }));
}));

// variable to construct the docker network name used by
// chaincode container to find peer node
process.env.COMPOSE_PROJECT_NAME = 'basicnetwork';

gulp.task('docker-ready', gulp.series('generate-config', () => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([
            // make sure that necessary containers are up by docker-compose
            util.format('docker-compose -f %s up -d', fs.realpathSync(path.join(testDir, 'docker-compose.yml')))
        ]));
}));

gulp.task('channel-init', gulp.series('docker-ready', shell.task([
    // create channel, join peer0 to the channel
    'docker exec cli /etc/hyperledger/config/channel-init.sh'
])));
