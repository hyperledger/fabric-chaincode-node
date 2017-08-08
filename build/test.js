'use strict';

const gulp = require('gulp');
const tape = require('gulp-tape');
const tapColorize = require('tap-colorize');
const istanbul = require('gulp-istanbul');
const util = require('util');
const fs = require('fs-extra');
const path = require('path');
const shell = require('gulp-shell');
const replace = require('gulp-replace');

const test = require('../test/base.js');

// by default for running the tests print debug to a file
let debugPath = path.join(test.tempdir, 'logs/test-debug.log');
console.log('\n####################################################');
console.log(util.format('# debug log: %s', debugPath));
console.log('####################################################\n');

gulp.task('instrument', function() {
	return gulp.src([
		'node_modules/fabric-shim/lib/**/*.js'])
		.pipe(istanbul())
		.pipe(istanbul.hookRequire());
});

gulp.task('clean-up', function() {
	// some tests create temporary files or directories
	// they are all created in the same temp folder
	fs.removeSync(test.tempdir);
	return fs.ensureFileSync(debugPath);
});

// re-use the "basic-network" artifacts from fabric-samples
// by copying them to the temp folder and override the
// docker-compose.yml's image tags to "latest"
let samplesPath = path.join(__dirname, '../../fabric-samples/basic-network');
let testDir = path.join(test.tempdir, 'basic-network');
gulp.task('docker-copy', function() {
	gulp.src([
		path.join(samplesPath, 'docker-compose.yml'),
	], {base: samplesPath})
		.pipe(replace(':x86_64-1.0.0', ':latest'))
		.pipe(replace(
			'- ./../chaincode/:/opt/gopath/src/github.com/',
			'- ./../chaincode/:/opt/gopath/src/github.com/\n' +
			'        - ./:/etc/hyperledger/config\n' +
			'        - ./config:/etc/hyperledger/configtx'))
		.pipe(replace(
			'- CORE_PEER_ID=cli',
			'- CORE_PEER_ID=cli\n' +
			'      - FABRIC_CFG_PATH=/etc/hyperledger/config'))
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

gulp.task('docker-clean', ['docker-copy'], shell.task([
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

gulp.task('docker-cli-ready', ['docker-clean'], shell.task([
	// make sure that necessary containers are up by docker-compose
	util.format('docker-compose -f %s up -d cli', fs.realpathSync(path.join(testDir, 'docker-compose.yml')))
]));

gulp.task('generate-config', ['docker-cli-ready'], shell.task([
	util.format('docker exec cli configtxgen -profile OneOrgOrdererGenesis -outputBlock %s',
		'/etc/hyperledger/config',
		'/etc/hyperledger/configtx/genesis.block'),
	util.format('docker exec cli configtxgen -profile OneOrgChannel -outputCreateChannelTx %s -channelID mychannel',
		'/etc/hyperledger/configtx/channel.tx'),
	'docker exec cli cp /etc/hyperledger/fabric/core.yaml /etc/hyperledger/config/'
], {
	verbose: true, // so we can see the docker command output
	ignoreErrors: true // kill and rm may fail because the containers may have been cleaned up
}));

gulp.task('docker-ready', ['generate-config'], shell.task([
	// make sure that necessary containers are up by docker-compose
	util.format('docker-compose -f %s up -d', fs.realpathSync(path.join(testDir, 'docker-compose.yml')))
]));

gulp.task('channel-init', ['docker-ready'], shell.task([
	// create channel, join peer0 to the channel
	'docker exec cli /etc/hyperledger/config/channel-init.sh'
]));

