/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const gulp = require('gulp');
const shell = require('gulp-shell');

const util = require('util');
const runSequence = require('run-sequence');

gulp.task('test-devmode',['invokeAllFnsInDev']);

gulp.task('invokeAllFnsInDev',(done)=>{

	const tasks = [

		// ensure that the fabric shim in it's entirity is copied over and verdaccioed
		'st-copy-shim-crypto',

		// ensure that the fabric is setup and the chaincode has been constructed
		'st-copy-chaincode',

		// Use the CLI to start up the chaincode
		'dm-startup-chaincode',

		// install
		'st-install_chaincode',

		// instantiate
		'st-instantiate_chaincode',
		'delay',
		// invoke all functions
		'invoke_functions'

	];

	console.log('=== Starting Dev Mode Tests'); // eslint-disable-line
	runSequence(...tasks,done);

});

gulp.task('dm-startup-chaincode', () => {
	return gulp.src('*.js', {read: false})
		.pipe(shell([
			util.format('docker exec cli bash -c "cd %s; npm install; node_modules/.bin/fabric-chaincode-node start --peer.address peer0.org1.example.com:7051 --chaincode-id-name %s"',
				// the /etc/hyperledger/config has been mapped to the
				// basic-network folder in the test setup for the CLI docker
				'/etc/hyperledger/config/scenario/src/mysmartcontract.v0',
				'mysmartcontract')

		]));
});