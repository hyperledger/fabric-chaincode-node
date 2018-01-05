/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const test = require('../base.js');
const sinon = require('sinon');
const rewire = require('rewire');
const Handler = rewire('fabric-shim/lib/handler.js');
const Stub = require('fabric-shim/lib/stub.js');
const MsgQueueHandler = Handler.__get__('MsgQueueHandler');
const QMsg = Handler.__get__('QMsg');

const grpc = require('grpc');
const path = require('path');

const StateQueryIterator = require('fabric-shim/lib/iterators.js').StateQueryIterator;
const HistoryQueryIterator = require('fabric-shim/lib/iterators.js').HistoryQueryIterator;

//chaincode object to handle chaincode interface calls Init() and Invoke()
const chaincodeObj = {
	Init: function() {},
	Invoke: function() {}
};

function getPeerAddress(isSecure) {
	let address = 'grpc://localhost:7051';
	if (isSecure && isSecure === true) {
		address = address.replace(/grpc/gi, 'grpcs');
	}
	return address;
}
let sandbox = sinon.sandbox.create();
let testHandler = new Handler(chaincodeObj, getPeerAddress(false));

test('handler.js constructor tests', (t) => {
	t.throws(
		() => {
			new Handler();
		},
		/Missing required argument: chaincode/,
		'Test error handling on missing chaincode argument'
	);

	t.throws(
		() => {
			new Handler({});
		},
		/The chaincode argument must implement the mandatory "Init\(\)" method/,
		'Test error handling on chaincode argument missing Init() method implementation'
	);

	t.throws(
		() => {
			new Handler({
				Init: function() {}
			});
		},
		/The chaincode argument must implement the mandatory "Invoke\(\)" method/,
		'Test error handling on chaincode argument missing Invoke() method implementation'
	);

	t.throws(
		() => {
			new Handler(chaincodeObj);
		},
		/Invalid URL: undefined/,
		'Test error handling on missing "url" argument'
	);

	t.throws(
		() => {
			new Handler(chaincodeObj, 'https://localhost:7051',
				{
					'pem': 'dummyPEMString',
					'ssl-target-name-override': 'dummyHost',
					'request-timeout': 12345,
					'another-property': 'dummyValue'
				});
		},
		/Invalid protocol: https.  URLs must begin with grpc:\/\/ or grpcs:\/\//,
		'Test error handling on invalid "https" url argument'
	);

	let handler;
	t.doesNotThrow(
		() => {
			handler = new Handler(chaincodeObj, getPeerAddress(false));
		},
		null,
		'Test positive handling of valid url argument'
	);

	t.equal(handler._endpoint.addr, 'localhost:7051', 'Test handler.addr value is properly set');
	t.equal(typeof handler._client !== 'undefined' && handler._client !== null, true, 'Test handler._client is properly set');

	t.throws(
		() => {
			new Handler(chaincodeObj, getPeerAddress(true));
		},
		/PEM encoded certificate is required/,
		'Test error handling on missing opts.pem when using grpcs://'
	);
	t.throws(
		() => {
			new Handler(chaincodeObj, getPeerAddress(true),
				{
					'pem': 'dummyPEMString',
					'ssl-target-name-override': 'dummyHost',
					'request-timeout': 12345,
					'another-property': 'dummyValue',
					'cert':'dummyCertString'
				});
		},
		/encoded Private key is required/,
		'Test error handling on missing opts.key when using grpcs://'
	);
	t.throws(
		() => {
			new Handler(chaincodeObj, getPeerAddress(true),
				{
					'pem': 'dummyPEMString',
					'ssl-target-name-override': 'dummyHost',
					'request-timeout': 12345,
					'another-property': 'dummyValue',
					'key':'dummyKeyString'
				});
		},
		/encoded client certificate is required/,
		'Test error handling on missing opts.cert when using grpcs://'
	);
	handler = new Handler(chaincodeObj, getPeerAddress(true),
		{
			'pem': 'dummyPEMString',
			'ssl-target-name-override': 'dummyHost',
			'request-timeout': 12345,
			'another-property': 'dummyValue7',
			'key':'dummyKeyString',
			'cert':'dummyCertString'
		});

	t.equal(handler._options['grpc.ssl_target_name_override'], 'dummyHost', 'Test converting opts.ssl-target-name-override to grpc.ssl_target_name_override');
	t.equal(handler._options['grpc.default_authority'], 'dummyHost', 'Test converting opts.ssl-target-name-override to grpc.default_authority');
	t.equal(handler._options['request-timeout'], 12345, 'Test processing request-time option');
	t.equal(handler._options['another-property'], 'dummyValue7', 'Test processing another-property option');

	// The DNS can be case sensitive in some cases (eg Docker DNS)
	handler = new Handler(chaincodeObj, 'grpc://Peer.Example.com:7051');
	t.equal(handler._endpoint.addr, 'Peer.Example.com:7051', 'Test handler.addr value preserves casing');

	t.end();
});

test('#handleInit tests', (t) => {
	let saveHandleMessage = Handler.__get__('handleMessage');
	let handleMessage = sinon.stub();
	Handler.__set__('handleMessage', handleMessage);
	testHandler.handleInit('some message');
	t.true(handleMessage.calledOnce, 'Test handleMessage was called');
	t.deepEqual(handleMessage.firstCall.args, ['some message', testHandler, 'init'], 'Test handleMessage was called with correct values');
	Handler.__set__('handleMessage', saveHandleMessage);
	t.end();
});

test('#handleTransaction tests', (t) => {
	let saveHandleMessage = Handler.__get__('handleMessage');
	let handleMessage = sinon.stub();
	Handler.__set__('handleMessage', handleMessage);
	testHandler.handleTransaction('some message');
	t.true(handleMessage.calledOnce, 'Test handleMessage was called');
	t.deepEqual(handleMessage.firstCall.args, ['some message', testHandler, 'invoke'], 'Test handleMessage was called with correct values');
	Handler.__set__('handleMessage', saveHandleMessage);
	t.end();
});

test('#handleGetState tests', async (t) => {
	let serviceProto = Handler.__get__('_serviceProto');

	sandbox.stub(testHandler, '_askPeerAndListen').resolves('some response');
	let result = await testHandler.handleGetState('theKey', 'theChannelID', 'theTxID');
	t.equal(result, 'some response', 'Test we get the expected response');
	let askArgs = testHandler._askPeerAndListen.firstCall.args;
	t.equal(askArgs.length, 2, 'Test _askPeerAndListen was called with correct number of arguments');
	t.equal(askArgs[1], 'GetState', 'Test _askPeerAndListen was called with GetState parameter');
	let payload = new serviceProto.GetState();
	payload.setKey('theKey');

	let expectedMsg = {
		type: serviceProto.ChaincodeMessage.Type.GET_STATE,
		payload: payload.toBuffer(),
		channel_id: 'theChannelID',
		txid: 'theTxID'
	};
	t.deepEqual(askArgs[0], expectedMsg, 'Test _askPeerAndListen was given the correct message');
	sandbox.restore();
	let error = new Error('some error');
	sandbox.stub(testHandler, '_askPeerAndListen').rejects(error);
	try {
		await testHandler.handleGetState('theKey', 'theChannelID', 'theTxID');
		t.fail('unexpected success when error should have occurred');
	}
	catch(err) {
		t.equal(err, error, 'Tests that the error is thrown');
	}
	sandbox.restore();
});

test('#handlePutState tests', async (t) => {
	let serviceProto = Handler.__get__('_serviceProto');
	let putState = sinon.createStubInstance(serviceProto.PutState);
	putState.toBuffer.returns('a buffer');
	let saveClass = serviceProto.PutState;
	class MockPutState {
		constructor() {
			return putState;
		}
	}
	serviceProto.PutState = MockPutState;

	sandbox.stub(testHandler, '_askPeerAndListen').resolves('some response');
	let result = await testHandler.handlePutState('theKey', 'some value', 'theChannelID', 'theTxID');
	t.equal(result, 'some response', 'Test we get the expected response');
	let askArgs = testHandler._askPeerAndListen.firstCall.args;
	t.equal(askArgs.length, 2, 'Test _askPeerAndListen was called with correct number of arguments');
	t.equal(askArgs[1], 'PutState', 'Test _askPeerAndListen was called with PutState parameter');
	let expectedMsg = {
		type: serviceProto.ChaincodeMessage.Type.PUT_STATE,
		payload: 'a buffer',
		channel_id: 'theChannelID',
		txid: 'theTxID'
	};
	t.deepEqual(askArgs[0], expectedMsg, 'Test _askPeerAndListen was given the correct message');
	t.true(putState.setKey.calledOnce, 'Test setKey was called');
	t.deepEqual(putState.setKey.firstCall.args, ['theKey'], 'Test setKey was called with correct value');
	t.true(putState.setValue.calledOnce, 'Test setValue was called');
	t.deepEqual(putState.setValue.firstCall.args, ['some value'], 'Test setValue was called with correct value');

	sandbox.restore();
	let error = new Error('some error');
	sandbox.stub(testHandler, '_askPeerAndListen').rejects(error);
	try {
		await testHandler.handlePutState('theKey', 'some value', 'theChannelID', 'theTxID');
		t.fail('unexpected success when error should have occurred');
	}
	catch(err) {
		t.equal(err, error, 'Tests that the error is thrown');
	}
	// restore everything back to what it was
	serviceProto.PutState = saveClass;
	sandbox.restore();
});

test('#handleDeleteState tests', async (t) => {
	let serviceProto = Handler.__get__('_serviceProto');
	sandbox.stub(testHandler, '_askPeerAndListen').resolves('some response');
	let result = await testHandler.handleDeleteState('theKey', 'theChannelID', 'theTxID');
	t.equal(result, 'some response', 'Test we get the expected response');
	let askArgs = testHandler._askPeerAndListen.firstCall.args;
	t.equal(askArgs.length, 2, 'Test _askPeerAndListen was called with correct number of arguments');
	t.equal(askArgs[1], 'DeleteState', 'Test _askPeerAndListen was called with DeleteState parameter');
	let payload = new serviceProto.DelState();
	payload.setKey('theKey');

	let expectedMsg = {
		type: serviceProto.ChaincodeMessage.Type.DEL_STATE,
		payload: payload.toBuffer(),
		channel_id: 'theChannelID',
		txid: 'theTxID'
	};
	t.deepEqual(askArgs[0], expectedMsg, 'Test _askPeerAndListen was given the correct message');
	sandbox.restore();
	let error = new Error('some error');
	sandbox.stub(testHandler, '_askPeerAndListen').rejects(error);
	try {
		await testHandler.handleGetState('theKey', 'theChannelID', 'theTxID');
		t.fail('unexpected success when error should have occurred');
	}
	catch(err) {
		t.equal(err, error, 'Tests that the error is thrown');
	}
	sandbox.restore();
});

test('#handleGetStateByRange tests', async (t) => {
	let serviceProto = Handler.__get__('_serviceProto');
	let rangeState = sinon.createStubInstance(serviceProto.GetStateByRange);
	rangeState.toBuffer.returns('a buffer');
	let saveClass = serviceProto.GetStateByRange;
	class MockGetStateByRange {
		constructor() {
			return rangeState;
		}
	}
	serviceProto.GetStateByRange = MockGetStateByRange;

	sandbox.stub(testHandler, '_askPeerAndListen').resolves('some response');
	let result = await testHandler.handleGetStateByRange('1stKey', '2ndKey', 'theChannelID', 'theTxID');
	t.equal(result, 'some response', 'Test we get the expected response');
	let askArgs = testHandler._askPeerAndListen.firstCall.args;
	t.equal(askArgs.length, 2, 'Test _askPeerAndListen was called with correct number of arguments');
	t.equal(askArgs[1], 'GetStateByRange', 'Test _askPeerAndListen was called with GetState parameter');
	let expectedMsg = {
		type: serviceProto.ChaincodeMessage.Type.GET_STATE_BY_RANGE,
		payload: 'a buffer',
		channel_id: 'theChannelID',
		txid: 'theTxID'
	};
	t.deepEqual(askArgs[0], expectedMsg, 'Test _askPeerAndListen was given the correct message');
	t.true(rangeState.setStartKey.calledOnce, 'Test setStartKey was called');
	t.deepEqual(rangeState.setStartKey.firstCall.args, ['1stKey'], 'Test setStartKey was called with correct value');
	t.true(rangeState.setEndKey.calledOnce, 'Test setEndKey was called');
	t.deepEqual(rangeState.setEndKey.firstCall.args, ['2ndKey'], 'Test setEndKey was called with correct value');

	sandbox.restore();
	let error = new Error('some error');
	sandbox.stub(testHandler, '_askPeerAndListen').rejects(error);
	try {
		await testHandler.handleGetStateByRange('1stKey', '2nd', 'theChannelID', 'theTxID');
		t.fail('unexpected success when error should have occurred');
	}
	catch(err) {
		t.equal(err, error, 'Tests that the error is thrown');
	}
	// restore everything back to what it was
	serviceProto.GetStateByRange = saveClass;
	sandbox.restore();
});

test('#handleQueryStateNext tests', async (t) => {
	let serviceProto = Handler.__get__('_serviceProto');
	let queryState = sinon.createStubInstance(serviceProto.QueryStateNext);
	queryState.toBuffer.returns('a buffer');
	let saveClass = serviceProto.QueryStateNext;
	class MockQueryStateNext {
		constructor() {
			return queryState;
		}
	}
	serviceProto.QueryStateNext = MockQueryStateNext;

	sandbox.stub(testHandler, '_askPeerAndListen').resolves('some response');
	let result = await testHandler.handleQueryStateNext('anID', 'theChannelID', 'theTxID');
	t.equal(result, 'some response', 'Test we get the expected response');
	let askArgs = testHandler._askPeerAndListen.firstCall.args;
	t.equal(askArgs.length, 2, 'Test _askPeerAndListen was called with correct number of arguments');
	t.equal(askArgs[1], 'QueryStateNext', 'Test _askPeerAndListen was called with QueryStateNext parameter');
	let expectedMsg = {
		type: serviceProto.ChaincodeMessage.Type.QUERY_STATE_NEXT,
		payload: 'a buffer',
		channel_id: 'theChannelID',
		txid: 'theTxID'
	};
	t.deepEqual(askArgs[0], expectedMsg, 'Test _askPeerAndListen was given the correct message');
	t.true(queryState.setId.calledOnce, 'Test setId was called');
	t.deepEqual(queryState.setId.firstCall.args, ['anID'], 'Test setId was called with correct value');

	sandbox.restore();
	let error = new Error('some error');
	sandbox.stub(testHandler, '_askPeerAndListen').rejects(error);
	try {
		await testHandler.handleQueryStateNext('anID', 'theChannelID', 'theTxID');
		t.fail('unexpected success when error should have occurred');
	}
	catch(err) {
		t.equal(err, error, 'Tests that the error is thrown');
	}
	// restore everything back to what it was
	serviceProto.QueryStateNext = saveClass;
	sandbox.restore();
});

test('#handleQueryStateClose tests', async (t) => {
	let serviceProto = Handler.__get__('_serviceProto');
	let queryClose = sinon.createStubInstance(serviceProto.QueryStateClose);
	queryClose.toBuffer.returns('a buffer');
	let saveClass = serviceProto.QueryStateClose;
	class MockQueryStateClose {
		constructor() {
			return queryClose;
		}
	}
	serviceProto.QueryStateClose = MockQueryStateClose;

	sandbox.stub(testHandler, '_askPeerAndListen').resolves('some response');
	let result = await testHandler.handleQueryStateClose('anID', 'theChannelID', 'theTxID');
	t.equal(result, 'some response', 'Test we get the expected response');
	let askArgs = testHandler._askPeerAndListen.firstCall.args;
	t.equal(askArgs.length, 2, 'Test _askPeerAndListen was called with correct number of arguments');
	t.equal(askArgs[1], 'QueryStateClose', 'Test _askPeerAndListen was called with QueryStateClose parameter');
	let expectedMsg = {
		type: serviceProto.ChaincodeMessage.Type.QUERY_STATE_CLOSE,
		payload: 'a buffer',
		channel_id: 'theChannelID',
		txid: 'theTxID'
	};
	t.deepEqual(askArgs[0], expectedMsg, 'Test _askPeerAndListen was given the correct message');
	t.true(queryClose.setId.calledOnce, 'Test setId was called');
	t.deepEqual(queryClose.setId.firstCall.args, ['anID'], 'Test setId was called with correct value');

	sandbox.restore();
	let error = new Error('some error');
	sandbox.stub(testHandler, '_askPeerAndListen').rejects(error);
	try {
		await testHandler.handleQueryStateNext('anID', 'theChannelID', 'theTxID');
		t.fail('unexpected success when error should have occurred');
	}
	catch(err) {
		t.equal(err, error, 'Tests that the error is thrown');
	}
	// restore everything back to what it was
	serviceProto.QueryStateClose = saveClass;
	sandbox.restore();
});

test('#handleGetQueryResult tests', async (t) => {
	let serviceProto = Handler.__get__('_serviceProto');
	let queryResult = sinon.createStubInstance(serviceProto.GetQueryResult);
	queryResult.toBuffer.returns('a buffer');
	let saveClass = serviceProto.GetQueryResult;
	class MockGetQueryResult {
		constructor() {
			return queryResult;
		}
	}
	serviceProto.GetQueryResult = MockGetQueryResult;

	sandbox.stub(testHandler, '_askPeerAndListen').resolves('some response');
	let result = await testHandler.handleGetQueryResult('aQuery', 'theChannelID', 'theTxID');
	t.equal(result, 'some response', 'Test we get the expected response');
	let askArgs = testHandler._askPeerAndListen.firstCall.args;
	t.equal(askArgs.length, 2, 'Test _askPeerAndListen was called with correct number of arguments');
	t.equal(askArgs[1], 'GetQueryResult', 'Test _askPeerAndListen was called with GetQueryResult parameter');
	let expectedMsg = {
		type: serviceProto.ChaincodeMessage.Type.GET_QUERY_RESULT,
		payload: 'a buffer',
		channel_id: 'theChannelID',
		txid: 'theTxID'
	};
	t.deepEqual(askArgs[0], expectedMsg, 'Test _askPeerAndListen was given the correct message');
	t.true(queryResult.setQuery.calledOnce, 'Test setQuery was called');
	t.deepEqual(queryResult.setQuery.firstCall.args, ['aQuery'], 'Test setQuery was called with correct value');

	sandbox.restore();
	let error = new Error('some error');
	sandbox.stub(testHandler, '_askPeerAndListen').rejects(error);
	try {
		await testHandler.handleQueryStateNext('aQuery', 'theChannelID', 'theTxID');
		t.fail('unexpected success when error should have occurred');
	}
	catch(err) {
		t.equal(err, error, 'Tests that the error is thrown');
	}
	// restore everything back to what it was
	serviceProto.GetQueryResult = saveClass;
	sandbox.restore();
});

test('#handleGetHistoryForKey tests', async (t) => {
	let serviceProto = Handler.__get__('_serviceProto');
	let historyForKey = sinon.createStubInstance(serviceProto.GetHistoryForKey);
	historyForKey.toBuffer.returns('a buffer');
	let saveClass = serviceProto.GetHistoryForKey;
	class MockGetHistoryForKey {
		constructor() {
			return historyForKey;
		}
	}
	serviceProto.GetHistoryForKey = MockGetHistoryForKey;

	sandbox.stub(testHandler, '_askPeerAndListen').resolves('some response');
	let result = await testHandler.handleGetHistoryForKey('aKey', 'theChannelID', 'theTxID');
	t.equal(result, 'some response', 'Test we get the expected response');
	let askArgs = testHandler._askPeerAndListen.firstCall.args;
	t.equal(askArgs.length, 2, 'Test _askPeerAndListen was called with correct number of arguments');
	t.equal(askArgs[1], 'GetHistoryForKey', 'Test _askPeerAndListen was called with GetHistoryForKey parameter');
	let expectedMsg = {
		type: serviceProto.ChaincodeMessage.Type.GET_HISTORY_FOR_KEY,
		payload: 'a buffer',
		channel_id: 'theChannelID',
		txid: 'theTxID'
	};
	t.deepEqual(askArgs[0], expectedMsg, 'Test _askPeerAndListen was given the correct message');
	t.true(historyForKey.setKey.calledOnce, 'Test setKey was called');
	t.deepEqual(historyForKey.setKey.firstCall.args, ['aKey'], 'Test setKey was called with correct value');

	sandbox.restore();
	let error = new Error('some error');
	sandbox.stub(testHandler, '_askPeerAndListen').rejects(error);
	try {
		await testHandler.handleQueryStateNext('aKey', 'theChannelID', 'theTxID');
		t.fail('unexpected success when error should have occurred');
	}
	catch(err) {
		t.equal(err, error, 'Tests that the error is thrown');
	}
	// restore everything back to what it was
	serviceProto.GetHistoryForKey = saveClass;
	sandbox.restore();
});

test('#handleInvokeChaincode tests', async (t) => {
	let serviceProto = Handler.__get__('_serviceProto');
	let chaincodeProto = Handler.__get__('_chaincodeProto');
	let responseProto = Handler.__get__('_responseProto');
	sandbox.stub(responseProto.Response, 'decode').returns('some response');

	let chaincodeSpec = sinon.createStubInstance(chaincodeProto.ChaincodeSpec);
	class MockChaincodeSpec {
		constructor() {
			return chaincodeSpec;
		}
	}
	let saveChaincodeSpec = chaincodeProto.ChaincodeSpec;
	chaincodeProto.ChaincodeSpec = MockChaincodeSpec;
	chaincodeSpec.toBuffer.returns('a buffer');

	let chaincodeId = sinon.createStubInstance(chaincodeProto.ChaincodeID);
	class MockChaincodeID {
		constructor() {
			return chaincodeId;
		}
	}
	let saveChaincodeId = chaincodeProto.ChaincodeID;
	chaincodeProto.ChaincodeID = MockChaincodeID;

	let chaincodeInput = sinon.createStubInstance(chaincodeProto.ChaincodeInput);
	class MockChaincodeInput {
		constructor() {
			return chaincodeInput;
		}
	}
	let saveChaincodeInput = chaincodeProto.ChaincodeInput;
	chaincodeProto.ChaincodeInput = MockChaincodeInput;


	let response = {
		type: serviceProto.ChaincodeMessage.Type.COMPLETED
	};
	sandbox.stub(testHandler, '_askPeerAndListen').resolves(response);
	let result = await testHandler.handleInvokeChaincode('ccname', ['arg1', 'arg2'], 'theChannelID', 'theTxID');
	t.equal(result, 'some response', 'Test we get the expected response');
	let askArgs = testHandler._askPeerAndListen.firstCall.args;
	t.equal(askArgs.length, 2, 'Test _askPeerAndListen was called with correct number of arguments');
	t.equal(askArgs[1], 'InvokeChaincode', 'Test _askPeerAndListen was called with GetHistoryForKey parameter');
	let expectedMsg = {
		type: serviceProto.ChaincodeMessage.Type.INVOKE_CHAINCODE,
		payload: 'a buffer',
		channel_id: 'theChannelID',
		txid: 'theTxID'
	};
	t.deepEqual(askArgs[0], expectedMsg, 'Test _askPeerAndListen was given the correct message');
	t.true(chaincodeId.setName.calledOnce, 'Test setName on chaincodeID was called');
	t.deepEqual(chaincodeId.setName.firstCall.args, ['ccname'], 'Test setName was called with correct value');
	t.true(chaincodeInput.setArgs.calledOnce, 'Test setArgs on chaincodeInput was called');
	t.deepEqual(chaincodeInput.setArgs.firstCall.args, [[Buffer.from('arg1'), Buffer.from('arg2')]], 'Test setArgs was called with correct value');
	t.true(chaincodeSpec.setChaincodeId.calledOnce, 'Test setChaincodeId on chaincodeSpec was called');
	//t.equal(chaincodeSpec.setChaincodeId.firstCall.args, [chaincodeId], 'Test setChaincodeId on chaincodeSpec was called with correct value');
	t.true(chaincodeSpec.setInput.calledOnce, 'Test setInput on chaincodeSpec was called');
	//t.equal(chaincodeSpec.setInput.firstCall.args, [chaincodeInput], 'Test setInput on chaincodeSpec was called with correct value');


	await testHandler.handleInvokeChaincode('ccname', [], 'theChannelID', 'theTxID');
	t.deepEqual(chaincodeInput.setArgs.secondCall.args, [[]], 'Test setArgs was called with empty array');

	sandbox.restore();
	response = {
		type: serviceProto.ChaincodeMessage.Type.ERROR,
		payload: Buffer.from('An Error occurred')
	};

	sandbox.stub(testHandler, '_askPeerAndListen').resolves(response);

	try {
		await testHandler.handleInvokeChaincode('ccname', [], 'theChannelID', 'theTxID');
		t.fail('expected error to be thrown');
	} catch(error) {
		t.equal(error.message, 'An Error occurred', 'Tests that the error response from invokeChaincode was thrown');
	}

	sandbox.restore();
	let error = new Error('some error');
	sandbox.stub(testHandler, '_askPeerAndListen').rejects(error);
	try {
		await testHandler.handleInvokeChaincode('', [], 'theChannelID', 'theTxID');
		t.fail('unexpected success when error should have occurred');
	}
	catch(err) {
		t.equal(err, error, 'Tests that the error is thrown');
	}
	// restore everything back to what it was
	chaincodeProto.ChaincodeSpec = saveChaincodeSpec;
	chaincodeProto.ChaincodeID = saveChaincodeId;
	chaincodeProto.ChaincodeInput = saveChaincodeInput;
	sandbox.restore();
});

test('#toString tests', (t) => {
	t.equal(testHandler.toString(), 'ChaincodeSupportClient : {url:grpc://localhost:7051}');
	t.end();
});

test('#shortTxid tests', (t) => {
	let shortTxid = Handler.__get__('shortTxid');
	t.equal(shortTxid('1234567'), '1234567');
	t.equal(shortTxid('12345678'), '12345678');
	t.equal(shortTxid('123456789'), '12345678');
	t.equal(shortTxid(''), '');
	t.end();
});

test('#newErrorMsg tests', (t) => {
	let newErrorMsg = Handler.__get__('newErrorMsg');
	let msg = {
		channel_id: 'theChannelID',
		txid: 'aTX',
		type: 'aType',
		payload: 'aPayload'
	};
	let result = newErrorMsg(msg, 'aState');
	let response = {
		type: 'ERROR',
		payload: Buffer.from('an error string'),
		channel_id: 'theChannelID',
		txid: 'aTX'
	};

	let str = result.payload.toString();
	let test = str.includes('aTX') && str.includes('aType') && str.includes('aState');

	t.equal(result.type, response.type, 'Tests the response is correct');
	t.true(test, 'Test payload includes info about the message');
	t.equal(result.txid, response.txid, 'Tests the response is correct');

	sandbox.restore();
	t.end();
});

test('#_askPeerAndListen', async (t) => {
	testHandler.msgQueueHandler = sinon.createStubInstance(MsgQueueHandler);
	testHandler.msgQueueHandler.queueMsg.callsFake((qMsg) => {
		qMsg.success('a payload');
	});
	let result = await testHandler._askPeerAndListen('some message', 'callMethod');
	t.equal(result, 'a payload', 'Test a resolved promise with payload is returned');

	t.end();
});

test('#close', (t) => {
	testHandler._stream = {end: sinon.stub()};
	testHandler.close();
	t.true(testHandler._stream.end.calledOnce,'Test end was called on the stream');
	t.end();
});


test('#parseResponse', (t) => {
	let serviceProto = Handler.__get__('_serviceProto');
	let parseResponse = Handler.__get__('parseResponse');
	let MSG_TYPE = Handler.__get__('MSG_TYPE');
	let saveQReso = serviceProto.QueryResponse;
	let saveCCMsg = serviceProto.ChaincodeMessage;
	serviceProto.QueryResponse = {
		decode: sinon.stub().returns('qr decoded payload')
	};

	serviceProto.ChaincodeMessage = {
		decode: sinon.stub().returns('cc decoded payload')
	};

	let res = {
		type: MSG_TYPE.RESPONSE,
		payload: 'a payload',
		channel_id: 'theChannelID',
		txid: 'aTx'
	};

	let result = parseResponse(testHandler, res, 'GetState');
	t.equal(result, res.payload, 'Test we get the right payload back');
	result = parseResponse(testHandler, res, 'PutState');
	t.equal(result, res.payload, 'Test we get the right payload back');

	result = parseResponse(testHandler, res, 'QueryStateClose');
	t.equal(result, 'qr decoded payload', 'Test we get the right payload back');
	result = parseResponse(testHandler, res, 'QueryStateNext');
	t.equal(result, 'qr decoded payload', 'Test we get the right payload back');
	result = parseResponse(testHandler, res, 'InvokeChaincode');
	t.equal(result, 'cc decoded payload', 'Test we get the right payload back');

	serviceProto.QueryResponse.decode.reset();
	result = parseResponse(testHandler, res, 'GetStateByRange');
	t.true(result instanceof StateQueryIterator);
	t.true(serviceProto.QueryResponse.decode.calledOnce, 'Test queryresponse decode was called');
	t.deepEqual(serviceProto.QueryResponse.decode.firstCall.args, [res.payload], 'Test queryresponse decode was called');

	serviceProto.QueryResponse.decode.reset();
	result = parseResponse(testHandler, res, 'GetQueryResult');
	t.true(result instanceof StateQueryIterator);
	t.true(serviceProto.QueryResponse.decode.calledOnce, 'Test queryresponse decode was called');
	t.deepEqual(serviceProto.QueryResponse.decode.firstCall.args, [res.payload], 'Test queryresponse decode was called');

	serviceProto.QueryResponse.decode.reset();
	result = parseResponse(testHandler, res, 'GetHistoryForKey');
	t.true(result instanceof HistoryQueryIterator);
	t.true(serviceProto.QueryResponse.decode.calledOnce, 'Test queryresponse decode was called');
	t.deepEqual(serviceProto.QueryResponse.decode.firstCall.args, [res.payload], 'Test queryresponse decode was called');

	// test error response
	res = {
		type: MSG_TYPE.ERROR,
		payload: Buffer.from('some error'),
		channel_id: 'theChannelID',
		txid: 'aTx'
	};

	try {
		parseResponse(testHandler, res, 'GetHistoryForKey');
		t.fail('unexpected success when error expected to be thrown');
	}
	catch(err) {
		t.true(err.toString().includes('some error'), 'Test expected error to be returned');
	}

	// test unknown response
	res = {
		type: 98674,
		payload: 'something',
		channel_id: 'theChannelID',
		txid: 'aTx'
	};

	try {
		parseResponse(testHandler, res, 'GetHistoryForKey');
		t.fail('unexpected success when error expected to be thrown');
	}
	catch(err) {
		t.true(err.toString().includes('GetHistoryForKey'), 'Test expected error to be returned');
	}

	serviceProto.QueryResponse = saveQReso;
	serviceProto.ChaincodeMessage = saveCCMsg;
	t.end();
});

test('#handleMessage', async (t) => {
	const handleMessage = Handler.__get__('handleMessage');
	const chaincodeProto = Handler.__get__('_chaincodeProto');
	const serviceProto = Handler.__get__('_serviceProto');
	const saveCCInput = chaincodeProto.ChaincodeInput;
	chaincodeProto.ChaincodeInput = {decode: sinon.stub()};

	const saveCreateStub = Handler.__get__('createStub');
	let stubCtr = sinon.stub();
	Handler.__set__('createStub', () => {return stubCtr;});

	let mockHandler = {};
	mockHandler._stream = {write: sinon.stub()};
	mockHandler.chaincode = {Init: sinon.stub(), Invoke: sinon.stub()};

	//action=init,invoke
	//msg:payload, txid, proposal
	let msg = {
		channel_id: 'theChannelID',
		txid: 'aTX',
		payload: 'some payload',
		proposal: 'some proposal'
	};
	let expectedResponse = {
		type: serviceProto.ChaincodeMessage.Type.COMPLETED,
		payload: 'a buffered payload',
		channel_id: 'theChannelID',
		txid: msg.txid,
		chaincode_event: undefined
	};

	chaincodeProto.ChaincodeInput.decode.returns('decoded payload');
	mockHandler.chaincode.Init.resolves({status: Stub.RESPONSE_CODE.OK, toBuffer: () => {
		return 'a buffered payload';
	}});
	mockHandler.chaincode.Invoke.resolves({status: Stub.RESPONSE_CODE.OK, toBuffer: () => {
		return 'a buffered invoke payload';
	}});

	await handleMessage(msg, mockHandler, 'init');
	t.true(mockHandler._stream.write.calledOnce, 'Test init a response is written to a stream');
	t.deepEqual(mockHandler._stream.write.firstCall.args, [expectedResponse], 'Test init a correct response written to stream');


	mockHandler._stream.write.reset();
	expectedResponse = {
		type: serviceProto.ChaincodeMessage.Type.COMPLETED,
		payload: 'a buffered invoke payload',
		channel_id: 'theChannelID',
		txid: msg.txid,
		chaincode_event: undefined
	};
	await handleMessage(msg, mockHandler, 'invoke');
	t.true(mockHandler._stream.write.calledOnce, 'Test invoke a response is written to a stream');
	t.deepEqual(mockHandler._stream.write.firstCall.args, [expectedResponse], 'Test invoke a correct response written to stream');

	chaincodeProto.ChaincodeInput = saveCCInput;
	Handler.__set__('createStub', saveCreateStub);
	t.end();


});

test('#chat', (t) => {
	testHandler.msgQueueHandler = null;
	let mockStream = {write: sinon.stub(), on: sinon.stub()};
	testHandler._client = {register: () => {
		return mockStream;
	}};
	testHandler.chat('initial message');
	t.true(mockStream.write.calledOnce, 'Test stream was written to');
	t.deepEqual(mockStream.write.firstCall.args, ['initial message'], 'Test correct message is sent');
	t.true(testHandler.msgQueueHandler instanceof MsgQueueHandler, 'Test Message queue handler is set up');
	t.equal(testHandler.msgQueueHandler.handler, testHandler, 'Test message queue handler is access to handler instance');
	t.equal(testHandler.msgQueueHandler.stream, mockStream, 'Test message queue handler is access to stream instance');
	t.equal(mockStream.on.callCount, 3, 'Test stream listeners registered');
	t.equal(mockStream.on.firstCall.args[0], 'data', 'Test we register for the data event');
	t.equal(mockStream.on.secondCall.args[0], 'end', 'Test we register for the end event');
	t.equal(mockStream.on.thirdCall.args[0], 'error', 'Test we register for the error event');
	t.end();
});

test('#stream:end event', (t) => {
	let eventReg = {};
	let mockEventEmitter = (event, cb) => {
		eventReg[event] = cb;
	};

	let mockStream = {write: sinon.stub(), on: mockEventEmitter, cancel: sinon.stub(), end: sinon.stub()};
	testHandler._client = {register: () => {
		return mockStream;
	}};
	testHandler.chat('initial message');
	eventReg['end']();

	t.true(mockStream.cancel.calledOnce, 'Test stream was ended');
	t.end();
});

test('#stream:error event', (t) => {
	let eventReg = {};
	let mockEventEmitter = (event, cb) => {
		eventReg[event] = cb;
	};

	let mockStream = {write: sinon.stub(), on: mockEventEmitter, cancel: sinon.stub(), end: sinon.stub()};
	testHandler._client = {register: () => {
		return mockStream;
	}};
	testHandler.chat('initial message');
	eventReg['error']({});

	t.true(mockStream.end.calledOnce, 'Test stream was ended');
	t.end();
});

test('#stream:data event', (t) => {
	let MSG_TYPE = Handler.__get__('MSG_TYPE');
	// state machine created-->established-->Ready
	// initial state is created
	// first test a complete valid sequence
	let eventReg = {};
	let mockEventEmitter = (event, cb) => {
		eventReg[event] = cb;
	};

	let mockStream = {write: sinon.stub(), on: mockEventEmitter, cancel: sinon.stub(), end: sinon.stub()};
	testHandler._client = {register: () => {
		return mockStream;
	}};
	let handleInitStub = sinon.stub(testHandler, 'handleInit');
	let handleTxnStub = sinon.stub(testHandler, 'handleTransaction');

	testHandler.chat('initial message');
	testHandler.msgQueueHandler = sinon.createStubInstance(MsgQueueHandler);

	let registeredMsg = {
		type: MSG_TYPE.REGISTERED
	};

	eventReg['data'](registeredMsg);

	// state should now be established
	let readyMsg = {
		type: MSG_TYPE.READY
	};
	eventReg['data'](readyMsg);

	// state should now be ready, can now accept: RESPONSE, ERROR, INIT, TRANSACTION
	let initMsg = {
		channel_id: 'theChannelID',
		txid: 'sometx',
		type: MSG_TYPE.INIT
	};
	eventReg['data'](initMsg);
	t.true(handleInitStub.calledOnce, 'Check handleInit was called');
	t.equal(handleInitStub.firstCall.args[0], initMsg, 'Check handleInit was called with right message');

	let txnMsg = {
		channel_id: 'theChannelID',
		txid: 'sometx',
		type: MSG_TYPE.TRANSACTION
	};
	eventReg['data'](txnMsg);
	t.true(handleTxnStub.calledOnce, 'Check handleTransaction was called');
	t.equal(handleTxnStub.firstCall.args[0], txnMsg, 'Check handleTransaction was called with right message');

	let respMsg = {
		channel_id: 'theChannelID',
		txid: 'sometx',
		type: MSG_TYPE.RESPONSE
	};
	eventReg['data'](respMsg);
	console.log(testHandler.msgQueueHandler);
	t.true(testHandler.msgQueueHandler.handleMsgResponse.calledOnce, 'Check handleTransaction was called');
	t.equal(testHandler.msgQueueHandler.handleMsgResponse.firstCall.args[0], respMsg, 'Check handleTransaction was called with right message');
	testHandler.msgQueueHandler.handleMsgResponse.reset();

	let errorMsg = {
		channel_id: 'theChannelID',
		txid: 'sometx',
		type: MSG_TYPE.ERROR
	};
	eventReg['data'](errorMsg);
	console.log(testHandler.msgQueueHandler);
	t.true(testHandler.msgQueueHandler.handleMsgResponse.calledOnce, 'Check handleTransaction was called');
	t.equal(testHandler.msgQueueHandler.handleMsgResponse.firstCall.args[0], errorMsg, 'Check handleTransaction was called with right message');
	testHandler.msgQueueHandler.handleMsgResponse.reset();

	t.end();

});


test('#MsgQueueHandler:queueMsg', (t) => {
	let qHandler = new MsgQueueHandler(testHandler);
	let sendMsg = sinon.stub(qHandler, '_sendMsg');
	let mockResolve = sinon.stub();
	let mockReject = sinon.stub();
	let msgToSend = {
		channel_id: 'theChannelID',
		txid: 'aTX',
		payload: 'some payload'
	};
	let qMsg = new QMsg(msgToSend, mockResolve, mockReject);
	qHandler.queueMsg(qMsg);
	t.true(sendMsg.calledOnce, 'Test the first message queued is sent');
	t.deepEqual(sendMsg.firstCall.args, ['theChannelIDaTX'], 'Test _sendMsg with the correct txContextId is called');
	t.equal(qHandler.txQueues['theChannelIDaTX'].length, 1, 'Test that message is added to queue');

	let msgToSend2 = {
		channel_id: 'theChannelID',
		txid: 'aTX',
		payload: 'another payload'
	};
	qMsg = new QMsg(msgToSend2, mockResolve, mockReject);
	qHandler.queueMsg(qMsg);
	t.true(sendMsg.calledOnce, 'Test the next message is just queued');
	t.equal(qHandler.txQueues['theChannelIDaTX'].length, 2, 'Test that message is added to queue');
	t.end();

	let msgToSend3 = {
		channel_id: 'theChannelID',
		txid: '2TX',
		payload: 'new payload for 2TX'
	};
	qMsg = new QMsg(msgToSend3, mockResolve, mockReject);
	qHandler.queueMsg(qMsg);
	t.true(sendMsg.calledTwice, 'Test this message was sent');
	t.equal(qHandler.txQueues['theChannelID2TX'].length, 1, 'Test that this message is added to queue');
	t.end();
});

test('#MsgQueueHandler:handleMsgResponse', (t) => {
	const saveParseResponse = Handler.__get__('parseResponse');
	let mockResolve = sinon.stub();
	let mockReject = sinon.stub();
	let qHandler = new MsgQueueHandler(testHandler);
	let mockQMsg = new QMsg('msgToSend', 'aMethod', mockResolve, mockReject);
	let getCurMsg = sinon.stub(qHandler, '_getCurrentMsg').returns(mockQMsg);
	let remCurMsg = sinon.stub(qHandler, '_removeCurrentAndSendNextMsg');
	let response = {
		channel_id: 'theChannelID',
		txid: 'aTX',
		payload: 'some payload'
	};
	Handler.__set__('parseResponse', (handler, res, method) => {
		t.equal(handler, testHandler, 'Test the handler passed is correct');
		t.deepEqual(res, response, 'Test the response passed is correct');
		t.equal(method, 'aMethod', 'Test the method passed is correct');
		return 'some payload';
	});

	qHandler.handleMsgResponse(response);
	t.true(getCurMsg.calledOnce, 'Test _getCurrentMsg was called');
	t.deepEqual(getCurMsg.firstCall.args, ['theChannelIDaTX'], 'Test _getCurrentMsg with the correct txContextId is called');
	t.true(mockResolve.calledOnce, 'Test resolve was called');
	t.deepEqual(mockResolve.firstCall.args, ['some payload'], 'Test resolve with the response is called');
	t.true(remCurMsg.calledOnce, 'Test _removeCurrentAndSendNextMsg was called');
	t.deepEqual(remCurMsg.firstCall.args, ['theChannelIDaTX'], 'Test _removeCurrentAndSendNextMsg with the correct txContextId is called');

	Handler.__set__('parseResponse', saveParseResponse);
	t.end();

});

test('#MsgQueueHandler:_getCurrentMsg', (t) => {
	let qHandler = new MsgQueueHandler(testHandler);
	qHandler.txQueues = {};
	qHandler.txQueues.aTX = ['top', 'middle', 'bottom'];
	qHandler.txQueues['2TX'] = ['left', 'right'];
	t.equal(qHandler._getCurrentMsg('aTX'), 'top', 'Test it get\'s the current message for aTX');
	t.equal(qHandler._getCurrentMsg('2TX'), 'left', 'Test it get\'s the current message for 2TX');
	t.end();
});

test('#MsgQueueHandler:_removeCurrentAndSendNextMsg', (t) => {
	let qHandler = new MsgQueueHandler(testHandler);
	qHandler.txQueues = {};
	qHandler.txQueues.aTX = ['top', 'middle', 'bottom'];
	qHandler.txQueues['2TX'] = ['left', 'right'];

	let sendMsg = sinon.stub(qHandler, '_sendMsg');

	// remove from aTX first
	qHandler._removeCurrentAndSendNextMsg('aTX');
	t.deepEqual(qHandler.txQueues.aTX, ['middle', 'bottom'], 'Test current message was removed');
	t.deepEqual(qHandler.txQueues['2TX'], ['left', 'right'], 'Test other queue not touched');
	t.equal(sendMsg.callCount, 1, 'Test send message was called');
	t.deepEqual(sendMsg.getCall(0).args, ['aTX'], 'Test send message was called with correct TXid');

	// remove from 2TX next
	qHandler._removeCurrentAndSendNextMsg('2TX');
	t.deepEqual(qHandler.txQueues.aTX, ['middle', 'bottom'], 'Test other queue not touched');
	t.deepEqual(qHandler.txQueues['2TX'], ['right'], 'current message was removed');
	t.equal(sendMsg.callCount, 2, 'Test send message was called');
	t.deepEqual(sendMsg.getCall(sendMsg.callCount-1).args, ['2TX'], 'Test send message was called with correct TXid');

	// remove from 2TX again
	qHandler._removeCurrentAndSendNextMsg('2TX');
	t.deepEqual(qHandler.txQueues.aTX, ['middle', 'bottom'], 'Test other queue not touched');
	t.equal(qHandler.txQueues['2TX'], undefined, 'current message was removed and queue deleted');
	t.equal(sendMsg.callCount, 2, 'Test no further send occurred');

	// remove from aTX
	qHandler._removeCurrentAndSendNextMsg('aTX');
	t.deepEqual(qHandler.txQueues.aTX, ['bottom'], 'current message was removed');
	t.equal(qHandler.txQueues['2TX'], undefined, 'other queue still doesn\'t exist');
	t.equal(sendMsg.callCount, 3, 'Test send message was called');
	t.deepEqual(sendMsg.getCall(sendMsg.callCount-1).args, ['aTX'], 'Test send message was called with correct TXid');

	// try to remove from 2TX
	qHandler._removeCurrentAndSendNextMsg('2TX');
	t.deepEqual(qHandler.txQueues.aTX, ['bottom'], 'other queue not touched');
	t.equal(qHandler.txQueues['2TX'], undefined, 'queue still doesn\'t exist');
	t.equal(sendMsg.callCount, 3, 'Test send message was never called');

	t.end();
});

test('#MsgQueueHandler:_sendMsg', (t) => {
	let stream = {write: sinon.stub()};
	let qHandler = new MsgQueueHandler(testHandler);
	qHandler.stream = stream;
	let msg = {channel_id: 'theChannelID', txid: 'aTX', payload:'msgToSend'};
	let mockResolve = sinon.stub();
	let mockReject = sinon.stub();
	let mockQMsg = new QMsg(msg, mockResolve, mockReject);
	let getCurMsg = sinon.stub(qHandler, '_getCurrentMsg').returns(mockQMsg);
	qHandler._sendMsg('theChannelIDaTX');
	t.true(getCurMsg.calledOnce, 'Test _getCurrentMsg was called');
	t.deepEqual(getCurMsg.firstCall.args, ['theChannelIDaTX'], 'Test _getCurrentMsg with the correct txContextId is called');
	t.true(stream.write.calledOnce, 'Test write was called');
	t.deepEqual(stream.write.firstCall.args, [msg], 'Test write was passed the correct message');
	t.equal(mockResolve.callCount, 0, 'Test resolve is never called');
	t.equal(mockReject.callCount, 0, 'Test reject is never called');

	// now test write throwing an error
	let error = new Error('write error');
	stream = {write: sinon.stub().throws(error)};
	qHandler = new MsgQueueHandler(testHandler);
	qHandler.stream = stream;
	msg = {channel_id: 'theChannelID', txid: 'aTX', payload:'msgToSend'};
	mockQMsg = new QMsg(msg, 'aMethod', mockResolve, mockReject);
	getCurMsg = sinon.stub(qHandler, '_getCurrentMsg').returns(mockQMsg);
	qHandler._sendMsg('theChannelIDaTX');
	t.true(getCurMsg.calledOnce, 'Test _getCurrentMsg was called');
	t.deepEqual(getCurMsg.firstCall.args, ['theChannelIDaTX'], 'Test _getCurrentMsg with the correct txContextId is called');
	t.true(stream.write.calledOnce, 'Test write was called');
	t.deepEqual(stream.write.firstCall.args, [msg], 'Test write was passed the correct message');
	t.equal(mockResolve.callCount, 0, 'Test resolve is never called');
	t.equal(mockReject.callCount, 1, 'Test reject is called');

	t.end();
});
