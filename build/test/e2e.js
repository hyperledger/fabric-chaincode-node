/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

// This is the optimistic end-to-end flow that exercise the
// chaincode shim APIs under the controlled flow:
//
// install -> instantiate -> invoke -> query -> upgrade -> invoke -> query
//
// other error-inducing flows can be found in other files in this folder
const gulp = require('gulp');
const shell = require('gulp-shell');
const rename = require('gulp-rename');
const wait = require('gulp-wait');
const util = require('util');
const fs = require('fs-extra');
const path = require('path');

const test = require('../../test/base.js');

const packageJson = '{' +
'  "name": "fabric-shim-test",' +
'  "version": "1.0.0-snapshot",' +
'  "description": "Test suite for fabric-shim",' +
'  "license": "Apache-2.0",' +
'  "dependencies": {' +
'    "fabric-shim": "file:./fabric-shim"' +
'  }' +
'}';

gulp.task('copy-shim', () => {
	// first ensure the chaincode folder has the latest shim code
	let srcPath = path.join(__dirname, '../../src/**');
	let destPath = path.join(test.BasicNetworkTestDir, 'src/mycc.v0/fabric-shim');
	fs.ensureDirSync(destPath);
	return gulp.src(srcPath)
		.pipe(gulp.dest(destPath));
});

gulp.task('copy-chaincode', () => {
	// create a package.json in the chaincode folder
	let destPath = path.join(test.BasicNetworkTestDir, 'src/mycc.v0/package.json');
	fs.writeFileSync(destPath, packageJson, 'utf8');

	// copy the test.js to chaincode folder as chaincode.js
	srcPath = path.join(__dirname, '../../test/integration/test.js');
	destPath = path.join(test.BasicNetworkTestDir, 'src/mycc.v0');
	return gulp.src(srcPath)
		.pipe(rename('chaincode.js'))
		.pipe(gulp.dest(destPath));
});

// make sure `gulp channel-init` is run first
gulp.task('test-e2e-install-v0', ['copy-shim', 'copy-chaincode'], () => {
	return gulp.src('*.js', {read: false})
		.pipe(shell([
			util.format('docker exec cli peer chaincode install -l node -n %s -v v0 -p %s',
				'mycc',
				// the /etc/hyperledger/config has been mapped to the
				// basic-network folder in the test setup for the CLI docker
				'/etc/hyperledger/config/src/mycc.v0')
		]));
});

gulp.task('test-e2e-instantiate-v0', ['test-e2e-install-v0'], () => {
	return gulp.src('*.js', {read: false})
		.pipe(shell([
			util.format('docker exec cli peer chaincode instantiate -l node -C %s -n %s -v v0 -c %s -P %s',
				'mychannel',
				'mycc',
				'\'{"Args":["init"]}\'',
				'\'OR ("Org1MSP.member")\'')
		]));
});

gulp.task('test-e2e-invoke-v0-test1-test2', ['test-e2e-instantiate-v0'], () => {
	return gulp.src('*.js', {read: false})
		// because the peer CLI for the instantiate call returns
		// before the transaction gets committed to the ledger, we
		// introduce a wait for 3 sec before running the invoke
		.pipe(wait(3000))
		.pipe(shell([
			// test1 and test2 of the chaincode are independent of each other,
			// can be called in parallel
			util.format('docker exec cli peer chaincode invoke -C %s -n %s -c %s',
				'mychannel',
				'mycc',
				'\'{"Args":["test1"]}\''),
			util.format('docker exec cli peer chaincode invoke -C %s -n %s -c %s',
				'mychannel',
				'mycc',
				'\'{"Args":["test2"]}\'')
		]));
});

gulp.task('test-e2e-invoke-v0-test3', ['test-e2e-invoke-v0-test1-test2'], () => {
	return gulp.src('*.js', {read: false})
		.pipe(wait(3000))
		.pipe(shell([
			// test1 and test2 of the chaincode are independent of each other,
			// can be called in parallel
			util.format('docker exec cli peer chaincode invoke -C %s -n %s -c %s',
				'mychannel',
				'mycc',
				'\'{"Args":["test3"]}\'')
		]));
});

gulp.task('test-e2e', ['test-e2e-invoke-v0-test3']);
