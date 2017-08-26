/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const gulp = require('gulp');
const util = require('util');
const fs = require('fs-extra');
const path = require('path');
const shell = require('gulp-shell');
const replace = require('gulp-replace');

const test = require('../../test/base.js');

// by default for running the tests print debug to a file
let debugPath = path.join(test.tempdir, 'logs/test-debug.log');
console.log('\n####################################################');
console.log(util.format('# debug log: %s', debugPath));
console.log('####################################################\n');

gulp.task('clean-up', function() {
	// some tests create temporary files or directories
	// they are all created in the same temp folder
	fs.removeSync(test.tempdir);
	return fs.ensureFileSync(debugPath);
});

// re-use the "basic-network" artifacts from fabric-samples
// by copying them to the temp folder and override the
// docker-compose.yml's content to fit the needs of the test environment
let samplesPath = test.BasicNetworkSamplePath;
let testDir = test.BasicNetworkTestDir;
let devmode = process.env.DEVMODE ? process.env.DEVMODE : 'true';
let tls = process.env.TLS ? process.env.TLS : 'false';
gulp.task('docker-copy', ['clean-up'], function() {
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
		path.join(samplesPath, '../chaincode') // copy the empty folder only
	], {base: samplesPath})
		.pipe(gulp.dest(testDir));

	return gulp.src([
		'test/fixtures/channel-init.sh'
	])
		.pipe(gulp.dest(testDir));
});

// This and other usage of the gulp-shell module cannot use the
// short-hand style because we must delay the use of the testDir
// to task invocation time, rather than module load time (which
// using the short-hand style will cause), because the testDir
// is not defined until the 'clean-up' task has been run
gulp.task('docker-clean', ['docker-copy'], () => {
	return gulp.src('*.js', {read: false})
		.pipe(shell([
			// stop and remove chaincode docker instances
			'docker kill $(docker ps | grep "dev-peer0.org[12].example.com-e" | awk \'{print $1}\')',
			'docker rm $(docker ps -a | grep "dev-peer0.org[12].example.com-e" | awk \'{print $1}\')',

			// remove chaincode images so that they get rebuilt during test
			'docker rmi $(docker images | grep "^dev-peer0.org[12].example.com-e" | awk \'{print $3}\')',

			// clean up all the containers created by docker-compose
			util.format('docker-compose -f %s down', fs.realpathSync(path.join(testDir, 'docker-compose.yml')))
		], {
			verbose: true, // so we can see the docker command output
			ignoreErrors: true // kill and rm may fail because the containers may have been cleaned up
		}));
});

gulp.task('docker-cli-ready', ['docker-clean'], () => {
	return gulp.src('*.js', {read: false})
		.pipe(shell([
			// make sure that necessary containers are up by docker-compose
			util.format('docker-compose -f %s up -d cli', fs.realpathSync(path.join(testDir, 'docker-compose.yml')))
		]));
});

gulp.task('generate-config', ['docker-cli-ready'], () => {
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
});

// variable to construct the docker network name used by
// chaincode container to find peer node
process.env.COMPOSE_PROJECT_NAME = 'basicnetwork';

gulp.task('docker-ready', ['generate-config'], () => {
	return gulp.src('*.js', {read: false})
		.pipe(shell([
			// make sure that necessary containers are up by docker-compose
			util.format('docker-compose -f %s up -d', fs.realpathSync(path.join(testDir, 'docker-compose.yml')))
		]));
});

gulp.task('channel-init', ['docker-ready'], shell.task([
	// create channel, join peer0 to the channel
	'docker exec cli /etc/hyperledger/config/channel-init.sh'
]));
