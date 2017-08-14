/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const shim = require('fabric-shim');
const util = require('util');

var Chaincode = class {
	Init(stub) {
		return stub.putState('dummyKey', Buffer.from('dummyValue'))
			.then(() => {
				return shim.success();
			}, () => {
				return shim.error();
			});
	}

	Invoke(stub) {
		console.info('Transaction ID: ' + stub.getTxID());
		console.info(util.format('Args: %j', stub.getArgs()));

		let ret = stub.getFunctionAndParameters();
		if (ret.fcn === 'test1') {
			console.info('Calling getState()');

			return stub.getState('dummyKey')
				.then((value) => {
					if (value.toString() === 'dummyValue') {
						console.info('Calling deleteState()');
						return stub.deleteState('dummyKey');
					} else {
						console.error('Failed to retrieve dummyKey or the retrieved value is not expected: ' + value);
						return shim.error();
					}
				}, (err) => {
					return shim.error(err);
				}).then(() => {
					console.info('Calling putState()');
					return stub.putState('dummyKey', Buffer.from('dummyValue'));
				}, (err) => {
					return shim.error();
				}).then(() => {
					return shim.success();
				}, (err) => {
					return shim.error(err);
				});
		} else if (ret.fcn === 'test2') {
			return stub.putState('key1', Buffer.from('value1'))
				.then(() => {
					return stub.putState('key2', Buffer.from('value2'));
				}).then(() => {
					return stub.putState('key3', Buffer.from('value3'));
				}).then(() => {
					console.log(util.format('Successfully putState() of key1, key2 and key3'));
					return shim.success();
				}).catch((err) => {
					return shim.error(err);
				});
		} else if (ret.fcn === 'test3') {
			return stub.getStateByRange('key1', 'key3')
				.then((result) => {
					console.log(util.format('Successfully getStateByRange(): %j', result));
					return shim.success();
				}).catch((err) => {
					return shim.error(err);
				});
		}

	}
};

shim.start(new Chaincode());