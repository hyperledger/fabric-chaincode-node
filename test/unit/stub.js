/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const ByteBuffer = require('bytebuffer');
const test = require('../base.js');

const Stub = require('fabric-shim/lib/stub.js');
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

test('Chaincode stub constructor tests', (t) => {
	// arguments from the protobuf are an array of ByteBuffer objects
	let buf1 = ByteBuffer.fromUTF8('invoke');
	let buf2 = ByteBuffer.fromUTF8('someKey');
	let buf3 = ByteBuffer.fromUTF8('someValue');

	t.throws(
		() => {
			new Stub(
				'dummyClient',
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
	header.setSignatureHeader(signatureHeader.toBuffer());
	sp.setHeader(header.toBuffer());
	sp.setPayload(Buffer.from('dummy proposal payload'));

	t.throws(
		() => {
			new Stub(
				'dummyClient',
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

	let ccpayload = new _proposalProto.ChaincodeProposalPayload();
	ccpayload.setInput(Buffer.from('dummyChaincodeInput'));
	sp.setPayload(ccpayload.toBuffer());
	let stub = new Stub(
		'dummyClient',
		'dummyTxid',
		{
			args: [buf1, buf2, buf3]
		},
		{
			proposal_bytes: sp.toBuffer()
		});
	t.equal(stub.args[0], 'invoke', 'Test parsing first argument');
	t.equal(stub.args[1], 'someKey', 'Test parsing second argument');

	t.end();
});

test('Arguments JSON-ify Tests', (t) => {
	let buf = ByteBuffer.fromUTF8('{\"a\":1,\"b\":2}');
	let sp = new _proposalProto.Proposal();
	let signatureHeader = new _commonProto.SignatureHeader();
	signatureHeader.setNonce(Buffer.from('12345'));
	let header = new _commonProto.Header();
	header.setSignatureHeader(signatureHeader.toBuffer());
	sp.setHeader(header.toBuffer());
	let ccpayload = new _proposalProto.ChaincodeProposalPayload();
	ccpayload.setInput(Buffer.from('dummyChaincodeInput'));
	sp.setPayload(ccpayload.toBuffer());
	let stub = new Stub(
		'dummyClient',
		'dummyTxid',
		{
			args: [buf]
		},
		{
			proposal_bytes: sp.toBuffer()
		});

	t.equal(stub.args[0].a, 1, 'Test parsing JSON arguments payload: a');
	t.equal(stub.args[0].b, 2, 'Test parsing JSON arguments payload: b');
	t.end();
});