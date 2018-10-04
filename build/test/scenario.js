/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const gulp = require('gulp');
const shell = require('gulp-shell');
const using = require('gulp-using');
const filter = require('gulp-filter');
const jsonTransform = require('gulp-json-transform');

const util = require('util');
const fs = require('fs-extra');
const path = require('path');
const runSequence = require('run-sequence');
const log = require('fancy-log');
const test = require('../../test/constants.js');

const os = require('os');

const execFile = util.promisify(require('child_process').execFile);
const CHANNEL_NAME = 'mychannel';
const tls = process.env.TLS ? process.env.TLS : 'false';
const delay = require('delay');

gulp.task('test-scenario',['invokeAllFns']);

/**
 * Invoke all the smart contract functions
 */
gulp.task('invokeAllFns',(done)=>{

	const tasks = [

		// ensure that the fabric shim in it's entirity is copied over and verdaccioed
		'st-copy-shim-crypto',

		// ensure that the fabric is setup and the chaincode has been constructed
		'st-copy-chaincode',

		// install
		'st-install_chaincode',

		// instantiate
		'st-instantiate_chaincode',
		'delay',
		// invoke all functions
		'invoke_functions'

	];

	console.log('=== Starting Scenario Tests'); // eslint-disable-line
	runSequence(...tasks,done);

});

gulp.task('delay',()=>{
	log('waiting for 3seconds...');
	return delay(3000);
});

/** */
function getTLSArgs() {
	let args = '';
	if (tls === 'true') {
		args = util.format('--tls %s --cafile %s', tls,
			'/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem');
	}
	return args;
}

gulp.task('invoke_functions',async (done)=>{

	const options={};
	const script = 'docker';
	const args = util.format('exec cli peer chaincode invoke %s -C %s -n %s -c %s --waitForEvent',
		getTLSArgs(),
		CHANNEL_NAME,
		'mysmartcontract',
		'{"Args":["org.mynamespace.updates:setNewAssetValue","42"]}').split(' ');

	const {error, stdout, stderr} = await execFile(script,args, options);
	if (error){
		done(error);
	}else {
		// validate the stdout/stderr
		console.log(stdout); // eslint-disable-line
		console.log(stderr); // eslint-disable-line

		// if the output needs to be parsed use this format
		// let data = JSON.parse(regexp.exec(stderr)[1].replace(/\\/g,''));

	}

});

gulp.task('st-copy-shim', ['protos'], () => {
	// first ensure the chaincode folder has the latest shim code
	const srcPath = path.join(__dirname, '../../fabric-shim/**');
	const destPath = path.join(test.BasicNetworkTestDir, 'scenario/src/fabric-shim');
	fs.ensureDirSync(destPath);

	const f = filter(['**/package.json'],{restore: true});

	return gulp.src(srcPath)
		.pipe(f)
		.pipe(using())
		.pipe(jsonTransform((data, file) => { // eslint-disable-line
			data.version = data.version+'-test';
			return data;
		}))
		.pipe(f.restore)
		.pipe(gulp.dest(destPath));
});

gulp.task('st-copy-api', ['st-copy-shim'], () => {
	// first ensure the chaincode folder has the latest shim code
	const srcPath = path.join(__dirname, '../../fabric-contract-api/**');
	const destPath = path.join(test.BasicNetworkTestDir, 'scenario/src/fabric-contract-api');
	fs.ensureDirSync(destPath);

	const f = filter(['**/package.json'],{restore: true});

	return gulp.src(srcPath)
		.pipe(f)
		.pipe(using())
		.pipe(jsonTransform((data, file) => { // eslint-disable-line
			data.version = data.version+'-test';
			return data;
		}))
		.pipe(f.restore)
		.pipe(gulp.dest(destPath));
});

gulp.task('st-copy-shim-crypto', ['st-copy-api'], () => {
	// first ensure the chaincode folder has the latest shim code
	const srcPath = path.join(__dirname, '../../fabric-shim-crypto/**');
	const destPath = path.join(test.BasicNetworkTestDir, 'scenario/src/fabric-shim-crypto');
	fs.ensureDirSync(destPath);

	const f = filter(['**/package.json'],{restore: true});

	return gulp.src(srcPath)
		.pipe(f)
		.pipe(using())
		.pipe(jsonTransform((data, file) => {  // eslint-disable-line
			data.version = data.version+'-test';
			return data;
		}))
		.pipe(f.restore)
		.pipe(gulp.dest(destPath));
});

gulp.task('st-copy-chaincode',['localpublish'] ,() => {

	// copy the test.js to chaincode folder
	const srcPath = path.join(__dirname, '../../test/scenario/*');
	const moduleArchivePath = path.join(test.BasicNetworkTestDir, 'scenario/src/*.tgz');
	const destPath = path.join(test.BasicNetworkTestDir, 'scenario/src/mysmartcontract.v0');
	return gulp.src([srcPath,'/tmp/.npmrc',moduleArchivePath])
		.pipe(gulp.dest(destPath));
});


gulp.task('localpublish',()=>{
	return gulp.src('*.js', {read: false})
		.pipe(shell([util.format('%s/local-npm.sh %s',__dirname, os.tmpdir())]));
});



// make sure `gulp channel-init` is run first
gulp.task('st-install_chaincode', () => {
	return gulp.src('*.js', {read: false})
		.pipe(shell([
			util.format('docker exec cli peer chaincode install -l node -n %s -v v0 -p %s',
				'mysmartcontract',
				// the /etc/hyperledger/config has been mapped to the
				// basic-network folder in the test setup for the CLI docker
				'/etc/hyperledger/config/scenario/src/mysmartcontract.v0')

		]));
});

gulp.task('st-instantiate_chaincode', () => {
	return gulp.src('*.js', {read: false})
		.pipe(shell([
			util.format('docker exec cli peer chaincode instantiate -o %s %s -l node -C %s -n %s -v v0 -c %s -P %s',
				'orderer.example.com:7050',
				getTLSArgs(),
				CHANNEL_NAME,
				'mysmartcontract',
				'\'{"Args":["org.mynamespace.updates:setup"]}\'',
				'\'OR ("Org1MSP.member")\'')
		]));
});
