/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';
const shim = require('fabric-shim');
const util = require('util');
const chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));

const a1 = {key: 'k1', value: 'value1'};
const a2 = {key: 'k2', value: 'value1'};
const a3 = {key: 'k3', value: 'value1'};


async function getAllResults(iterator) {
	let allResults = [];
	while (true) {
		let res = await iterator.next();
		if (res.value.namespace) console.log(res.value.namespace);
		if (res.value.key) console.log(res.value.key);
		if (res.value.tx_id) console.log(res.value.tx_id);
		if (res.value.timestamp) console.log(res.value.timestamp);
		if (res.value.is_delete) console.log(res.value.is_delete);
		let theVal = res.value.value.toString('utf8');
		allResults.push(theVal);
		console.log(theVal);
		if (res.done) {
			console.log('end of data');
			await iterator.close();
			return allResults;
		}
	}
}

let Chaincode = class {
	async Init(stub) {
		let ret = stub.getFunctionAndParameters();
		// initialise only if no parameter passed.
		if (ret.params.length === 0) {
			try {
				await stub.putState('dummyKey', Buffer.from('dummyValue'));
				return shim.success();
			} catch(err) {
				return shim.error(err);
			}
		} else {
			try {
				await stub.putState('whoami', Buffer.from('mycc2'));
				return shim.success();
			} catch(err) {
				return shim.error(err);
			}
		}
	}

	async Invoke(stub) {
		console.info('Transaction ID: ' + stub.getTxID());
		console.info(util.format('Args: %j', stub.getArgs()));

		let ret = stub.getFunctionAndParameters();

		let method = this[ret.fcn];
		if (!method) {
			console.log('no method of name:' + ret.fcn + ' found');
			return shim.success();
		}
		try {
			let payload =  await method(stub, ret.params);
			return shim.success(payload);
		} catch(err) {
			console.log(err);
			return shim.error(err);
		}
	}

	async test1(stub, args) {
		console.info('Calling getState()');

		let value = await stub.getState('dummyKey');
		value.toString().should.equal('dummyValue');

		console.info('Calling deleteState()');
		await stub.deleteState('dummyKey');

		console.info('Calling putState()');
		await stub.putState('dummyKey', Buffer.from('dummyValue'));
	}

	async test2(stub, args) {
		await stub.putState('key1', Buffer.from('value1'));
		await stub.putState('key2', Buffer.from('value2'));
		await stub.putState('key3', Buffer.from('value3'));
		await stub.putState('key4', Buffer.from(JSON.stringify(a1)));
		await stub.putState('key5', Buffer.from(JSON.stringify(a2)));
		await stub.putState('key6', Buffer.from(JSON.stringify(a3)));
		console.log(util.format('Successfully putState() of key1, key2, key3, key4, key5, key6'));
	}

	async test3(stub, args) {
		let iterator = await stub.getStateByRange('key2', 'key6');
		let results = await getAllResults(iterator);
		// getStateByRange is an inclusive start key, but exclusive end key
		let expectedResults = [
			'value2', 'value3',
			JSON.stringify(a1), JSON.stringify(a2)
		];
		results.should.deep.equal(expectedResults);
	}

	async test4(stub, args) {
		(await stub.getState('key1')).toString('utf8').should.equal('value1');
		(await stub.getState('key2')).toString('utf8').should.equal('value2');
		(await stub.getState('key3')).toString('utf8').should.equal('value3');
		(await stub.getState('key4')).toString('utf8').should.deep.equal(JSON.stringify(a1));
		(await stub.getState('key5')).toString('utf8').should.deep.equal(JSON.stringify(a2));
		(await stub.getState('key6')).toString('utf8').should.deep.equal(JSON.stringify(a3));
	}


	async test5(stub, args) {
		let query = {
			selector: {
				key: {
					$regex: 'k[2-9]'
				}
			}
		};

		// query gets rewritten as
		//query={"limit":10000,"selector":{"$and":[{"chaincodeid":"mycc"},{"data.key":{"$regex":"k[2-9]"}}]},"skip":0}
		let iterator = await stub.getQueryResult(JSON.stringify(query));
		let results = await getAllResults(iterator);
		let expectedResults = [
			JSON.stringify(a2), JSON.stringify(a3)
		];
		results.should.deep.equal(expectedResults);
	}

	async test6(stub, args) {
		let iterator = await stub.getHistoryForKey('key1');
		let results = await getAllResults(iterator);
		// tricky one verify for now, just see if it runs without error
	}

	async test7(stub, args) {
		console.log('invoking chaincode');
		let results = await stub.invokeChaincode('mycc2', ['getKey', 'whoami']);
		results.payload.toString('utf8').should.equal('mycc2');
	}


	// useful helper transactions
	async getKey(stub, args) {
		if (args.length !== 1) {
			throw new Error('Incorrect no. of parameters');
		}
		let res = await stub.getState(args[0]);
		console.log(res);
		return res;
	}

	async addKey(stub, args) {
		if (args.length !== 2) {
			throw new Error('Incorrect no. of parameters');
		}

		await stub.putState(args[0], Buffer.from(args[1]));
		console.log('put ' + args[1] + ' into ' + args[0]);
	}

};

shim.start(new Chaincode());