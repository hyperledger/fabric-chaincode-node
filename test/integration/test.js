/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';
const shim = require('fabric-shim');
const util = require('util');
/*
example using async/await for when node8 is available.
async function getAllResults(iterator) {
	while (true) {
		let res = await iterator.next();
		console.log(res.value.key);
		console.log(res.value.value.toString('utf8'));
		console.log(res.done);

		// process value
		if (res.done) break;
	}
}
*/

let Chaincode = class {
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
			return stub.getStateByRange('','')
				.then((iterator) => {
					// example using async/await pattern for when node 8 is ready
					// return getAllResults(iterator);

					// example using the emitter pattern: Start
					iterator
						.on('data', (iterator, res) => {
							console.log(res.value.key);
							console.log(res.value.value.toString('utf8'));
							console.log(res.done);
							iterator.next();
						})
						.on('end', (iterator) => {
							console.log('end of data');
							iterator.close();
						});
					iterator.next();
					// emitter pattern: End
				})
				.then(() => {
					return shim.success();
				}).catch((err) => {
					return shim.error(err);
				});
		} else if (ret.fcn === 'test4') {
			return stub.getState('key1')
				.then((res) => {
					console.log(res.toString('utf8'));
					return stub.getState('key2');
				})
				.then((res) => {
					console.log(res.toString('utf8'));
					return stub.getState('key3');
				})
				.then((res) => {
					console.log(res.toString('utf8'));
					return shim.success();
				}).catch((err) => {
					return shim.error(err);
				});
		} else if (ret.fcn === 'test5') {
			if (ret.params.length !== 2) {
				return shim.error('Incorrect no. of parameters');
			}
			return stub.putState(ret.params[0], Buffer.from(ret.params[1]))
				.then(() => {
					return shim.success('put ' + ret.params[1] + ' into ' + ret.params[0]);
				})
				.catch((err) => {
					return shim.error(err);
				});
		}

	}
};

shim.start(new Chaincode());