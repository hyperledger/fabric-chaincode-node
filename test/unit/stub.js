/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const ByteBuffer = require('bytebuffer');
const test = require('../base.js');
const sinon = require('sinon');
const rewire = require('rewire');
const testutil = require('./util.js');

const Stub = rewire('fabric-shim/lib/stub.js');
const Handler = require('fabric-shim/lib/handler.js');
const StateQueryIterator = require('fabric-shim/lib/iterators.js').StateQueryIterator;
const HistoryQueryIterator = require('fabric-shim/lib/iterators.js').HistoryQueryIterator;

const grpc = require('grpc');
const path = require('path');

const _commonProto = grpc.load({
	root: path.join(__dirname, '../../src/lib/protos'),
	file: 'common/common.proto'
}).common;

const _proposalProto = grpc.load({
	root: path.join(__dirname, '../../src/lib/protos'),
	file: 'peer/proposal.proto'
}).protos;

const _cclProto = grpc.load({
	root: path.join(__dirname, '../../src/lib/protos'),
	file: 'peer/chaincode.proto'
}).protos;

const _idProto = grpc.load({
	root: path.join(__dirname, '../../src/lib/protos'),
	file: 'msp/identities.proto'
}).msp;

const EXPECTED_MAX_RUNE = '\u{10ffff}';

test('Chaincode stub constructor tests', (t) => {
	// arguments from the protobuf are an array of ByteBuffer objects
	let buf1 = ByteBuffer.fromUTF8('invoke');
	let buf2 = ByteBuffer.fromUTF8('someKey');
	let buf3 = ByteBuffer.fromUTF8('someValue');

	t.throws(
		() => {
			new Stub(
				'dummyClient',
				'dummyChanelId',
				'dummyTxid',
				{
					args: [buf1, buf2, buf3]
				},
				'dummySignedProposal');
		},
		/Failed extracting proposal from signedProposal/,
		'Test invalid proposal object'
	);

	let sp = new _proposalProto.Proposal();

	t.throws(
		() => {
			new Stub(
				'dummyClient',
				'dummyChanelId',
				'dummyTxid',
				{
					args: [buf1, buf2, buf3]
				},
				{
					proposal_bytes: sp.toBuffer()
				});
		},
		/Proposal header is empty/,
		'Test proposal object with empty header'
	);

	sp.setHeader(Buffer.from('dummyHeader'));

	t.throws(
		() => {
			new Stub(
				'dummyClient',
				'dummyChanelId',
				'dummyTxid',
				{
					args: [buf1, buf2, buf3]
				},
				{
					proposal_bytes: sp.toBuffer()
				});
		},
		/Proposal payload is empty/,
		'Test proposal object with empty payload'
	);

	sp.setPayload(Buffer.from('dummyPayload'));

	t.throws(
		() => {
			new Stub(
				'dummyClient',
				'dummyChanelId',
				'dummyTxid',
				{
					args: [buf1, buf2, buf3]
				},
				{
					proposal_bytes: sp.toBuffer()
				});
		},
		/Could not extract the header from the proposal/,
		'Test proposal object with invalid header'
	);

	let header = new _commonProto.Header();

	header.setSignatureHeader(Buffer.from('dummySignatureHeader'));
	sp.setHeader(header.toBuffer());

	t.throws(
		() => {
			new Stub(
				'dummyClient',
				'dummyChanelId',
				'dummyTxid',
				{
					args: [buf1, buf2, buf3]
				},
				{
					proposal_bytes: sp.toBuffer()
				});
		},
		/Decoding SignatureHeader failed/,
		'Test proposal object with invalid signature header'
	);

	let signatureHeader = new _commonProto.SignatureHeader();
	signatureHeader.setNonce(Buffer.from('12345'));
	signatureHeader.setCreator(Buffer.from('dummyCreator'));
	header.setSignatureHeader(signatureHeader.toBuffer());
	sp.setHeader(header.toBuffer());

	t.throws(
		() => {
			new Stub(
				'dummyClient',
				'dummyChanelId',
				'dummyTxid',
				{
					args: [buf1, buf2, buf3]
				},
				{
					proposal_bytes: sp.toBuffer()
				});
		},
		/Decoding SerializedIdentity failed/,
		'Test proposal object with invalid creator'
	);

	signatureHeader = new _commonProto.SignatureHeader();
	signatureHeader.setNonce(Buffer.from('12345'));
	signatureHeader.setCreator(new _idProto.SerializedIdentity().toBuffer());
	header.setSignatureHeader(signatureHeader.toBuffer());
	sp.setHeader(header.toBuffer());
	sp.setPayload(Buffer.from('dummy proposal payload'));

	t.throws(
		() => {
			new Stub(
				'dummyClient',
				'dummyChanelId',
				'dummyTxid',
				{
					args: [buf1, buf2, buf3]
				},
				{
					proposal_bytes: sp.toBuffer()
				});
		},
		/Decoding ChaincodeProposalPayload failed/,
		'Test proposal object with invalid proposal payload'
	);

	header.setChannelHeader(Buffer.from('dummyChannelHeader'));
	sp.setHeader(header.toBuffer());

	t.throws(
		() => {
			new Stub(
				'dummyClient',
				'dummyChanelId',
				'dummyTxid',
				{
					args: []
				},
				{
					proposal_bytes: sp.toBuffer()
				});
		},
		/Decoding ChannelHeader failed/,
		'Test catching invalid ChannelHeader'
	);

	header = new _commonProto.Header();
	header.setSignatureHeader(signatureHeader.toBuffer());
	sp.setHeader(header.toBuffer());

	let ccpayload = new _proposalProto.ChaincodeProposalPayload();
	ccpayload.setInput(Buffer.from('dummyChaincodeInput'));
	sp.setPayload(ccpayload.toBuffer());
	let stub = new Stub(
		'dummyClient',
		'dummyChanelId',
		'dummyTxid',
		{
			args: [buf1, buf2, buf3]
		},
		{
			proposal_bytes: sp.toBuffer()
		});
	t.equal(stub.args[0], 'invoke', 'Test parsing first argument');
	t.equal(stub.args[1], 'someKey', 'Test parsing second argument');
	t.equal(stub.getTxID(), 'dummyTxid', 'Test getTxID()');
	t.equal(stub.getChannelID(), 'dummyChanelId', 'Test getChannelID()');

	// test the computeProposalBinding() method
	let cHeader = new _commonProto.ChannelHeader();
	cHeader.setEpoch(10);
	let sHeader = new _commonProto.SignatureHeader();
	sHeader.setNonce(Buffer.from('nonce'));
	let sid = new _idProto.SerializedIdentity();
	sid.setIdBytes(Buffer.from('creator'));
	sid.setMspid('testMSP');
	sHeader.setCreator(sid.toBuffer());
	header = new _commonProto.Header();
	header.setChannelHeader(cHeader.toBuffer());
	header.setSignatureHeader(sHeader.toBuffer());
	sp = new _proposalProto.Proposal();
	sp.setHeader(header.toBuffer());
	sp.setPayload(ccpayload.toBuffer());
	stub = new Stub(
		'dummyClient',
		'dummyChanelId',
		'dummyTxid',
		{
			args: [buf1, buf2, buf3]
		},
		{
			proposal_bytes: sp.toBuffer()
		});
	t.equal(stub.binding, '81dd35bc764b01dd7f3f38513c6c0e5d5583d4e5568fa74c4847fd29228b51e4', 'Test computeProposalBinding() returning expected hex for the binding hash');

	t.end();
});

test('getTxTimestamp', (t) => {
	let stub = new Stub(
		'dummyClient',
		'dummyChanelId',
		'dummyTxid',
		{
			args: []
		},
		{
			proposal_bytes: testutil.newProposal().toBuffer()
		});

	let ts = stub.getTxTimestamp();
	t.equal(typeof ts.nanos, 'number', 'Test getTxTimestamp() returns propery value: has "nanos" {number} field');
	t.equal(typeof ts.seconds, 'object', 'Test getTxTimestamp() returns propery value: has "seconds" {object} field');

	t.end();
});

test('computeProposalBinding', (t) => {
	let sp = {
		proposal: {
			header: {
				signature_header: {
					nonce: Buffer.from('nonce'),
					creator: {
						toBuffer: function() { return Buffer.from('creator'); }
					}
				},
				channel_header: {
					epoch: { high: 0, low: 10 }
				}
			}
		}
	};
	let fcn = Stub.__get__('computeProposalBinding');
	let hex = fcn(sp);
	t.equal(hex, '5093dd4f4277e964da8f4afbde0a9674d17f2a6a5961f0670fc21ae9b67f2983', 'Test computeProposalBinding() returning expected hex for the hash');

	t.end();
});

test('invokeChaincode', async (t) => {
	let mockHandler = sinon.createStubInstance(Handler);
	let stub = new Stub(
		mockHandler,
		'dummyChanelId',
		'dummyTxid',
		{
			args: []
		},
		{
			proposal_bytes: testutil.newProposal().toBuffer()
		});
	mockHandler.handleInvokeChaincode.resolves('response');

	let dummyArgs = ['arg', 'arg2'];
	let allProm = [];

	await stub.invokeChaincode('mycc', dummyArgs);
	t.deepEqual(mockHandler.handleInvokeChaincode.firstCall.args, ['mycc', dummyArgs, 'dummyChanelId', 'dummyTxid'], 'Test called with correct arguments');
	await stub.invokeChaincode('mycc', dummyArgs, 'mychannel');
	t.deepEqual(mockHandler.handleInvokeChaincode.secondCall.args, ['mycc/mychannel', dummyArgs, 'dummyChanelId', 'dummyTxid'], 'Test called with correct arguments');
});

test('getState', async (t) => {
	let mockHandler = sinon.createStubInstance(Handler);
	let stub = new Stub(
		mockHandler,
		'dummyChanelId',
		'dummyTxid',
		{
			args: []
		},
		{
			proposal_bytes: testutil.newProposal().toBuffer()
		});

	// getState will return a Buffer object
	mockHandler.handleGetState.withArgs('key1', 'dummyChanelId', 'dummyTxid').resolves(Buffer.from('response'));

	let response = await stub.getState('key1');
	t.equal(response.toString(), 'response', 'Test getState invokes correctly amd response is correct');
});

test('putState', async (t) => {
	let mockHandler = sinon.createStubInstance(Handler);
	let stub = new Stub(
		mockHandler,
		'dummyChanelId',
		'dummyTxid',
		{
			args: []
		},
		{
			proposal_bytes: testutil.newProposal().toBuffer()
		});
	mockHandler.handlePutState.resolves('response');

	// Must create a Buffer from your data.
	let dataToPut = Buffer.from('some data');
	await stub.putState('key1', dataToPut);
	t.deepEqual(mockHandler.handlePutState.firstCall.args, ['key1', dataToPut, 'dummyChanelId', 'dummyTxid'], 'Test call to handler is correct');
});

test('deleteState', async (t) => {
	let mockHandler = sinon.createStubInstance(Handler);
	let stub = new Stub(
		mockHandler,
		'dummyChanelId',
		'dummyTxid',
		{
			args: []
		},
		{
			proposal_bytes: testutil.newProposal().toBuffer()
		});
	mockHandler.handleDeleteState.resolves('response');

	await stub.deleteState('key1');
	t.deepEqual(mockHandler.handleDeleteState.firstCall.args, ['key1', 'dummyChanelId', 'dummyTxid'], 'Test call to handler is correct');
});

test('getHistoryForKey', async (t) => {
	let mockHandler = sinon.createStubInstance(Handler);
	let mockIterator = sinon.createStubInstance(HistoryQueryIterator);
	let stub = new Stub(
		mockHandler,
		'dummyChanelId',
		'dummyTxid',
		{
			args: []
		},
		{
			proposal_bytes: testutil.newProposal().toBuffer()
		});
	mockHandler.handleGetHistoryForKey.resolves(mockIterator);

	let result = await stub.getHistoryForKey('key1');
	t.equal(result, mockIterator, 'Test it returns an iterator');
	t.deepEqual(mockHandler.handleGetHistoryForKey.firstCall.args, ['key1', 'dummyChanelId', 'dummyTxid'], 'Test call to handler is correct');
});

test('getQueryResult', async (t) => {
	let mockHandler = sinon.createStubInstance(Handler);
	let mockIterator = sinon.createStubInstance(StateQueryIterator);
	let stub = new Stub(
		mockHandler,
		'dummyChanelId',
		'dummyTxid',
		{
			args: []
		},
		{
			proposal_bytes: testutil.newProposal().toBuffer()
		});
	mockHandler.handleGetQueryResult.resolves(mockIterator);

	let result = await stub.getQueryResult('query1');
	t.equal(result, mockIterator, 'Test it returns an iterator');
	t.deepEqual(mockHandler.handleGetQueryResult.firstCall.args, ['query1', 'dummyChanelId', 'dummyTxid'], 'Test call to handler is correct');
});


test('getStateByRange', async (t) => {
	let mockHandler = sinon.createStubInstance(Handler);
	let mockIterator = sinon.createStubInstance(StateQueryIterator);
	let stub = new Stub(
		mockHandler,
		'dummyChanelId',
		'dummyTxid',
		{
			args: []
		},
		{
			proposal_bytes: testutil.newProposal().toBuffer()
		});
	mockHandler.handleGetStateByRange.resolves(mockIterator);

	let result = await stub.getStateByRange('start', 'end');
	t.equal(result, mockIterator, 'Test it returns an iterator');
	t.deepEqual(mockHandler.handleGetStateByRange.firstCall.args, ['start', 'end', 'dummyChanelId', 'dummyTxid'], 'Test call to handler is correct');

	result = await stub.getStateByRange('', 'end');
	t.equal(result, mockIterator, 'Test it returns an iterator');
	t.deepEqual(mockHandler.handleGetStateByRange.secondCall.args, ['\x01', 'end', 'dummyChanelId', 'dummyTxid'], 'Test call to handler is correct');

	result = await stub.getStateByRange(null, 'end');
	t.equal(result, mockIterator, 'Test it returns an iterator');
	t.deepEqual(mockHandler.handleGetStateByRange.thirdCall.args, ['\x01', 'end', 'dummyChanelId', 'dummyTxid'], 'Test call to handler is correct');
});



test('setEvent', (t) => {
	let stub = new Stub(
		'dummyClient',
		'dummyChanelId',
		'dummyTxid',
		{
			args: []
		},
		{
			proposal_bytes: testutil.newProposal().toBuffer()
		});

	t.throws(
		() => {
			stub.setEvent();
		},
		/non-empty/,
		'Test catching no parameters'
	);

	t.throws(
		() => {
			stub.setEvent('', 'some data');
		},
		/non-empty/,
		'Test catching blank event name'
	);

	t.throws(
		() => {
			stub.setEvent(['arg'], 'some data');
		},
		/non-empty/,
		'Test catching no string event name'
	);

	stub.setEvent('event1', Buffer.from('payload1'));
	t.equal(stub.chaincodeEvent.getEventName(), 'event1', 'Test event name is correct');
	t.deepEqual(stub.chaincodeEvent.getPayload().toString('utf8'), 'payload1', 'Test payload is correct');
	t.end();
});

test('CreateCompositeKey', (t) => {
	let stub = new Stub(
		'dummyClient',
		'dummyChanelId',
		'dummyTxid',
		{
			args: []
		},
		{
			proposal_bytes: testutil.newProposal().toBuffer()
		});

	t.throws(
		() => {
			stub.createCompositeKey();
		},
		/non-zero length/,
		'Test catching invalid object type'
	);

	t.throws(
		() => {
			stub.createCompositeKey('key');
		},
		/must be an array/,
		'Test catching invalid attributes'
	);

	t.equal(stub.createCompositeKey('key', []), '\u0000key\u0000', 'Test createCompositeKey with no attributes returns expected key');
	t.equal(stub.createCompositeKey('key', ['attr1']), '\u0000key\u0000attr1\u0000', 'Test createCompositeKey with single attribute returns expected key');
	t.equal(stub.createCompositeKey('key', ['attr1', 'attr2','attr3']), '\u0000key\u0000attr1\u0000attr2\u0000attr3\u0000', 'Test createCompositeKey with multiple attributes returns expected key');

	t.end();
});

test('splitCompositeKey: ', (t) => {
	let objectType;
	let attributes;
	let stub = new Stub(
		'dummyClient',
		'dummyChanelId',
		'dummyTxid',
		{
			args: []
		},
		{
			proposal_bytes: testutil.newProposal().toBuffer()
		});

	// test splitting stuff that was created using the createCompositeKey calls
	({objectType, attributes} = stub.splitCompositeKey(stub.createCompositeKey('key', [])));
	t.equal(objectType, 'key', 'Test splitting of compositeKey with only object type, objecttype part');
	t.deepEqual(attributes, [], 'Test splitting of compositeKey with only object type, attributes part');

	({objectType, attributes} = stub.splitCompositeKey(stub.createCompositeKey('key', ['attr1'])));
	t.equal(objectType, 'key', 'Test splitting of compositeKey with 1 attribute, objecttype part');
	t.deepEqual(attributes, ['attr1'], 'Test splitting of compositeKey with 1 attribute, attributes part');

	({objectType, attributes} = stub.splitCompositeKey(stub.createCompositeKey('key', ['attr1', 'attr2'])));
	t.equal(objectType, 'key', 'Test splitting of compositeKey with >1 attributes, objecttype part');
	t.deepEqual(attributes, ['attr1', 'attr2'], 'Test splitting of compositeKey with >1 attributes, attributes part');

	// pass in duff values
	t.deepEqual(stub.splitCompositeKey(), {objectType: null, attributes: []}, 'Test no value passed');
	t.deepEqual(stub.splitCompositeKey('something'), {objectType: null, attributes: []}, 'Test no delimited value passed');
	t.deepEqual(stub.splitCompositeKey('something\u0000\hello'), {objectType: null, attributes: []}, 'Test incorrectly delimited value passed');
	t.deepEqual(stub.splitCompositeKey('\x00'), {objectType: null, attributes: []}, 'Test on delimiter value passed');

	t.end();
});

test('getStartByPartialCompositeKey', (t) => {
	let stub = new Stub(
		'dummyClient',
		'dummyChanelId',
		'dummyTxid',
		{
			args: []
		},
		{
			proposal_bytes: testutil.newProposal().toBuffer()
		}
	);

	let expectedKey = '\u0000key\u0000attr1\u0000attr2\u0000';
	let cckStub = sinon.stub(stub, 'createCompositeKey').returns(expectedKey);
	let gsbrStub = sinon.stub(stub, 'getStateByRange');

	stub.getStateByPartialCompositeKey('key', ['attr1', 'attr2']);
	t.equal(cckStub.calledOnce, true, 'Test getStateByPartialCompositeKey calls createCompositeKey once');
	t.deepEqual(cckStub.firstCall.args, ['key', ['attr1', 'attr2']], 'Test getStateByPartialCompositeKey calls createCompositeKey with the correct parameters');
	t.equal(gsbrStub.calledOnce, true, 'Test getStateByPartialCompositeKey calls getStateByRange Once');
	t.deepEqual(gsbrStub.firstCall.args, [expectedKey, expectedKey + EXPECTED_MAX_RUNE], 'Test getStateByPartialCompositeKey calls getStateByRange with the right arguments');
	t.end();

});

test('Arguments Tests', (t) => {
	let buf1 = ByteBuffer.fromUTF8('invoke');
	let buf2 = ByteBuffer.fromUTF8('key');
	let buf3 = ByteBuffer.fromUTF8('value');
	let stub = new Stub(
		'dummyClient',
		'dummyChanelId',
		'dummyTxid',
		{
			args: [buf1, buf2, buf3]
		},
		{
			proposal_bytes: testutil.newProposal().toBuffer()
		});

	t.equal(stub.getArgs().length, 3, 'Test getArgs() returns expected number of arguments');
	t.equal(typeof stub.getArgs()[0], 'string', 'Test getArgs() returns the first argument as string');
	t.equal(stub.getArgs()[1], 'key', 'Test getArgs() returns the 2nd argument as string "key"');
	t.equal(stub.getStringArgs().length, 3, 'Test getStringArgs() returns expected number of arguments');
	t.equal(stub.getStringArgs()[2], 'value', 'Test getStringArgs() returns 3rd argument as string "value"');
	t.equal(typeof stub.getFunctionAndParameters(), 'object', 'Test getFunctionAndParameters() returns and object');
	t.equal(stub.getFunctionAndParameters().fcn, 'invoke', 'Test getFunctionAndParameters() returns the function name properly');
	t.equal(Array.isArray(stub.getFunctionAndParameters().params), true, 'Test getFunctionAndParameters() returns the params array');
	t.equal(stub.getFunctionAndParameters().params.length, 2, 'Test getFunctionAndParameters() returns the params array with 2 elements');
	t.equal(stub.getFunctionAndParameters().params[0], 'key', 'Test getFunctionAndParameters() returns the "key" string as the first param');
	t.equal(stub.getFunctionAndParameters().params[1], 'value', 'Test getFunctionAndParameters() returns the "value" string as the 2nd param');

	stub = new Stub(
		'dummyClient',
		'dummyChanelId',
		'dummyTxid',
		{
			args: [buf1]
		},
		{
			proposal_bytes: testutil.newProposal().toBuffer()
		});
	t.equal(stub.getFunctionAndParameters().fcn, 'invoke', 'Test getFunctionAndParameters() returns the function name properly');
	t.equal(stub.getFunctionAndParameters().params.length, 0, 'Test getFunctionAndParameters() returns the params array with 0 elements');

	stub = new Stub(
		'dummyClient',
		'dummyChanelId',
		'dummyTxid',
		{
			args: []
		},
		{
			proposal_bytes: testutil.newProposal(true).toBuffer(),
			signature: Buffer.from('dummyHex')
		});
	t.equal(stub.getFunctionAndParameters().fcn, '', 'Test getFunctionAndParameters() returns empty function name properly');
	t.equal(stub.getFunctionAndParameters().params.length, 0, 'Test getFunctionAndParameters() returns the params array with 0 elements');

	t.equal(stub.getCreator().getMspid(), 'dummyMSPId', 'Test getCreator() returns the expected buffer object');
	t.equal(stub.getTransient().get('testKey').toBuffer().toString(), 'testValue', 'Test getTransient() returns the expected transient map object');

	t.equal(stub.getSignedProposal().signature.toString(), 'dummyHex', 'Test getSignedProposal() returns valid signature');
	t.equal(stub.getSignedProposal().proposal.header.signature_header.nonce.toString(), '12345', 'Test getSignedProposal() returns valid nonce');
	t.equal(stub.getSignedProposal().proposal.header.signature_header.creator.mspid, 'dummyMSPId', 'Test getSignedProposal() returns valid mspid');

	t.end();
});
