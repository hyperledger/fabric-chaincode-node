/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';
const shim = require('fabric-shim');
const ChaincodeCrypto = require('fabric-shim-crypto');
const util = require('util');
const chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));

const a1 = {key: 'k1', value: 'value1'};
const a2 = {key: 'k2', value: 'value1'};
const a3 = {key: 'k3', value: 'value1'};
const assert = chai.assert;

async function getAllResults(iterator, getKeys) {
	let allResults = [];
	while (true) {
		let res = await iterator.next();
		if (res.value.namespace) console.log(res.value.namespace);
		if (res.value.key) console.log(res.value.key);
		if (res.value.tx_id) console.log(res.value.tx_id);
		if (res.value.channel_id) console.log(res.value.channel_id);
		if (res.value.timestamp) console.log(res.value.timestamp);
		if (res.value.is_delete) console.log(res.value.is_delete);
		let theVal = (getKeys) ? res.value.key : res.value.value.toString('utf8');
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
		console.info('Transaction ID: ' + stub.getTxID());
		console.info('Channel ID: ' + stub.getChannelID());

		let ret = stub.getFunctionAndParameters();
		// initialise only if no parameter passed.
		if (ret.params.length === 0) {
			try {
				await stub.putState('dummyKey', Buffer.from('dummyValue1'));
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
		console.info('Channel ID: ' + stub.getChannelID());
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
		//value.toString().should.equal('dummyValue1');

		console.info('Calling deleteState()');
		await stub.deleteState('dummyKey');

		console.info('Calling putState()');
		await stub.putState('dummyKey', Buffer.from('dummyValue2'));
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

	// test invoking chaincode where chaincode responds with a success.
	async test7(stub, args) {
		let results = await stub.invokeChaincode('mycc2', ['getKey', 'whoami']);
		results.payload.toString('utf8').should.equal('mycc2');
	}

	// this tests concurrent invocation support
	test8(stub, args) {
		let p1 = stub.getState('key1')
			.then((res) => {
				res.toString('utf8').should.equal('value1');
			});

		let p2 = stub.getState('key2')
			.then((res) => {
				res.toString('utf8').should.equal('value2');
			});

		let p3 = stub.getState('key3')
			.then((res) => {
				res.toString('utf8').should.equal('value3');
			});

		return Promise.all([p1, p2, p3])
			.then(() => {
				return 'I completed ok';
			});
	}

	// this tests the composite key features - step 1: build the composite key and save to the ledger
	test9(stub, args) {
		let key1 = stub.createCompositeKey('color~name', ['blue', 'name1']);
		let key2 = stub.createCompositeKey('color~name', ['blue', 'name2']);
		let key3 = stub.createCompositeKey('color~name', ['red', 'name3']);

		let p1 = stub.putState(key1, 'dummyValue3')
			.then((res) => {
				assert.isOk(true, 'Successfully put a state using composite key ' + key1);
			}, (err) => {
				assert.fail('Failed to put a state using composite key ' + key1);
			});

		let p2 = stub.putState(key2, 'dummyValue4')
			.then((res) => {
				assert.isOk(true, 'Successfully put a state using composite key ' + key2);
			}, (err) => {
				assert.fail('Failed to put a state using composite key ' + key2);
			});

		let p3 = stub.putState(key3, 'dummyValue5')
			.then((res) => {
				assert.isOk(true, 'Successfully put a state using composite key ' + key3);
			}, (err) => {
				assert.fail('Failed to put a state using composite key ' + key3);
			});

		return Promise.all([p1, p2, p3])
			.then(() => {
				return 'I completed ok';
			});
	}

	// this tests the composite key features - step 2: query back the composite key and validate its attributes
	async test10(stub, args) {
		let iterator = await stub.getStateByPartialCompositeKey('color~name', ['blue']);
		let results = await getAllResults(iterator, true /* get keys instead of values */);
		results.length.should.equal(2, 'Should return 2 composite key matching color "blue"');

		let key1 = stub.splitCompositeKey(results[0]);
		key1.objectType.should.equal('color~name', '"objectType" value of the returned composite key should be "color~name"');
		key1.attributes.length.should.equal(2, '"attributes" value of the returned composite key should be array of size 2');
		key1.attributes[0].should.equal('blue', 'first attribute value of the returned composite key should be "blue"');
		key1.attributes[1].should.equal('name1', '2nd attribute value of the returned composite key should be "name1"');

		let key2 = stub.splitCompositeKey(results[0]);
		key2.objectType.should.equal('color~name', '"objectType" value of the returned composite key should be "color~name"');
		key2.attributes.length.should.equal(2, '"attributes" value of the returned composite key should be array of size 2');
		key2.attributes[0].should.equal('blue', 'first attribute value of the returned composite key should be "blue"');
		key2.attributes[1].should.equal('name1', '2nd attribute value of the returned composite key should be "name2"');

		// test the ClientIdentiy class
		let cid = new shim.ClientIdentity(stub);
		cid.mspId.should.equal('Org1MSP', 'Test mspId value');
		cid.getID().should.equal('x509::/C=US/ST=California/L=San Francisco/CN=Admin@org1.example.com::/C=US/ST=California/L=San Francisco/O=org1.example.com/CN=ca.org1.example.com', 'Test getID()');
	}

	// tests the encryption of state values
	async test11(stub, args) {
		// construct the encrypter, the stub is required to contain a transient map
		// with a key "encrypt-key", which will be used to encrypt the values
		let encrypter = new ChaincodeCrypto(stub);
		let ciphertext = encrypter.encrypt(Buffer.from(args[1])); // 2nd arg has the new value to encrypt
		await stub.putState(args[0], ciphertext); // 1st arg has the key
	}

	// tests the descryption of state values
	async test12(stub, args) {
		// construct the decrypter, the stub is required to contain a transient map
		// with a key "encKey", which will be used to decrypt the values
		let decrypter = new ChaincodeCrypto(stub);
		let ciphertext = await stub.getState(args[0]);
		let value = decrypter.decrypt(ciphertext).toString();
		value.should.equal(args[1], 'Test state value decryption with the ChaincodeCrypto library');
	}

	// test the signing of state values
	async test13(stub, args) {
		let signer = new ChaincodeCrypto(stub);
		let signature = signer.sign(Buffer.from(args[1]));
		let state = {
			signature: signature,
			value: args[1]
		};

		await stub.putState(args[0], Buffer.from(JSON.stringify(state)));
	}

	// test signature verifying
	async test14(stub, args) {
		let verifier = new ChaincodeCrypto(stub);
		let stateRaw = await stub.getState(args[0]);
		let json = JSON.parse(stateRaw.toString());
		// signature is originally a buffer
		let sig = Buffer.from(json.signature);
		let result = verifier.verify(sig, json.value);
		result.ok.should.equal(true, 'Test signature verification with the ChaincodeCrypto Library');
	}

	// test invoking chaincode where chaincode throws an error.
	async test15(stub, args) {
		let error;
		try {
			let results = await stub.invokeChaincode('mycc2', ['getKey']);
			results.should.be.false; // if we get here then we should fail
		} catch(error_) {
			error = error_;
		}
		error.message.should.match(/Incorrect no. of parameters/);
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
