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

let Chaincode = class {
	async Init(stub) {
		try {
			await stub.putState('dummyKey', Buffer.from('dummyValue'));
			return shim.success();
		} catch(err) {
			return shim.error();
		}
	}

	async Invoke(stub) {
		console.info('Transaction ID: ' + stub.getTxID());
		console.info(util.format('Args: %j', stub.getArgs()));

		let ret = stub.getFunctionAndParameters();
		if (ret.fcn === 'test1') {
			console.info('Calling getState()');

			try {
				let value = await stub.getState('dummyKey');

				if (value.toString() === 'dummyValue') {
					console.info('Calling deleteState()');
					await stub.deleteState('dummyKey');

					console.info('Calling putState()');
					await stub.putState('dummyKey', Buffer.from('dummyValue'));

					return shim.success();
				} else {
					console.error('Failed to retrieve dummyKey or the retrieved value is not expected: ' + value);
					return shim.error();
				}
			} catch(err) {
				return shim.error(err);
			}
		} else if (ret.fcn === 'test2') {
			let a1 = {key: 'k1', value: 'value1'};
			let a2 = {key: 'k2', value: 'value1'};
			let a3 = {key: 'k3', value: 'value1'};

			try{
				await stub.putState('key1', Buffer.from('value1'));
				await stub.putState('key2', Buffer.from('value2'));
				await stub.putState('key3', Buffer.from('value3'));
				await stub.putState('key4', Buffer.from(JSON.stringify(a1)));
				await stub.putState('key5', Buffer.from(JSON.stringify(a2)));
				await stub.putState('key6', Buffer.from(JSON.stringify(a3)));
				console.log(util.format('Successfully putState() of key1, key2, key3, key4, key5, key6'));
				return shim.success();
			} catch(err) {
				return shim.error(err);
			}
		} else if (ret.fcn === 'test3') {
			try {
				let iterator = await stub.getStateByRange('', '');
				return await getAllResults(iterator);
			} catch(err) {
				console.log(err);
				return shim.error(err);
			}
		} else if (ret.fcn === 'test4') {
			try {
				let res = await stub.getState('key1');
				console.log(res.toString('utf8'));
				res = await stub.getState('key2');
				console.log(res.toString('utf8'));
				res = await stub.getState('key3');
				console.log(res.toString('utf8'));
				return shim.success();
			} catch(err) {
				return shim.error(err);
			}
		} else if (ret.fcn === 'test5') {
			if (ret.params.length !== 2) {
				return shim.error('Incorrect no. of parameters');
			}

			try {
				await stub.putState(ret.params[0], Buffer.from(ret.params[1]));
				return shim.success('put ' + ret.params[1] + ' into ' + ret.params[0]);
			} catch(err) {
				return shim.error(err);
			}
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
			try {
				let iterator = await stub.getQueryResult(JSON.stringify(query));
				return await getAllResults(iterator);
			} catch(err) {
				console.log(err);
				return shim.error(err);
			}
		} else if (ret.fcn === 'test7') {
			try {
				let iterator = await stub.getHistoryForKey('key1');
				return await getAllResults(iterator);
			} catch(err) {
				console.log(err);
				return shim.error(err);
			}
		} else if (ret.fcn === 'test8') {
			console.log('invoking chaincode');
			let results = await stub.invokeChaincode('mycc2', ['test1']);
			console.log(results);
			return shim.success();
		} else {
			return shim.success();
		}

	}
};

shim.start(new Chaincode());