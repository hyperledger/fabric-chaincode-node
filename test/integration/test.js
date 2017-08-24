/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';
const shim = require('fabric-shim');
const util = require('util');

/*
process.on('unhandledRejection', () => {
	console.log(arguments);
});
*/

/*
//example using async/await for when node8 is available.
async function getAllResults(iterator) {
	while (true) {
		let res = await iterator.next();
		if (res.value.namespace) console.log(res.value.namespace);
		if (res.value.key) console.log(res.value.key);
		if (res.value.tx_id) console.log(res.value.tx_id);
		if (res.value.timestamp) console.log(res.value.timestamp);
		if (res.value.is_delete) console.log(res.value.is_delete);

		console.log(res.value.value.toString('utf8'));
		if (res.done) {
			console.log('end of data');
			iterator.close();
			return shim.success();
			break;
		}
	}
}
*/

function getAllResults(iterator, resolve) {
	iterator
		.on('data', (iterator, res) => {
			// namespace, key, value are query results
			// tx_id, timestamp, is_delete, value are history results

			if (res.value.namespace) console.log(res.value.namespace);
			if (res.value.key) console.log(res.value.key);
			if (res.value.tx_id) console.log(res.value.tx_id);
			if (res.value.timestamp) console.log(res.value.timestamp);
			if (res.value.is_delete) console.log(res.value.is_delete);

			console.log(res.value.value.toString('utf8'));
			console.log(res.done);
			if (!res.done) {
				iterator.next();
			}
		})
		.on('end', (iterator) => {
			console.log('end of data');
			iterator.close();
			resolve(shim.success());
		});
	iterator.next();
}

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
			let a1 = {key: 'k1', value: 'value1'};
			let a2 = {key: 'k2', value: 'value1'};
			let a3 = {key: 'k3', value: 'value1'};

			return stub.putState('key1', Buffer.from('value1'))
				.then(() => {
					return stub.putState('key2', Buffer.from('value2'));
				}).then(() => {
					return stub.putState('key3', Buffer.from('value3'));
				}).then(() => {
					return stub.putState('key4', Buffer.from(JSON.stringify(a1)));
				}).then(() => {
					return stub.putState('key5', Buffer.from(JSON.stringify(a2)));
				}).then(() => {
					return stub.putState('key6', Buffer.from(JSON.stringify(a3)));
				}).then(() => {
					console.log(util.format('Successfully putState() of key1, key2, key3, key4, key5, key6'));
					return shim.success();
				}).catch((err) => {
					return shim.error(err);
				});
		} else if (ret.fcn === 'test3') {
			/*
			// example using async/await
			return stub.getStateByRange('', '')
				.then((iterator) => {
					return getAllResults(iterator);
				})
				.catch((err) => {
					console.log(err);
					return shim.error(err);
				});
			*/
			return new Promise((resolve, reject) => {
				stub.getStateByRange('','')
					.then((iterator) => {
						getAllResults(iterator, resolve);
					})
					.catch((err) => {
						console.log(err);
						reject(shim.error(err));
					});

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
		} else if (ret.fcn === 'test6') {
			let query = {
				selector: {
					key: {
						$regex: 'k[2-9]'
					}
				}
			};

			// query gets rewritten as
			//query={"limit":10000,"selector":{"$and":[{"chaincodeid":"mycc"},{"data.key":{"$regex":"k[2-9]"}}]},"skip":0}
			return new Promise((resolve, reject) => {
				stub.getQueryResult(JSON.stringify(query))
					.then((iterator) => {
						getAllResults(iterator, resolve);
					})
					.catch((err) => {
						console.log(err);
						reject(shim.error(err));
					});

			});
		} else if (ret.fcn === 'test7') {
			return new Promise((resolve, reject) => {
				stub.getHistoryForKey('key1')
					.then((iterator) => {
						getAllResults(iterator, resolve);
					})
					.catch((err) => {
						console.log(err);
						reject(shim.error(err));
					});
			});
		} else if (ret.fcn === 'test8') {
			console.log('invoking chaincode');
			return stub.invokeChaincode('mycc2', ['test1'])
				.then((results) => {
					console.log(results);
					return shim.success();
				});
		} else {
			return shim.success();
		}

	}
};

shim.start(new Chaincode());