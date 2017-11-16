/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const path = require('path');
const grpc = require('grpc');
const ByteBuffer = require('bytebuffer');
const Stub = require('fabric-shim/lib/stub.js');

const _idProto = grpc.load({
	root: path.join(__dirname, '../../src/lib/protos'),
	file: 'msp/identities.proto'
}).msp;

const _commonProto = grpc.load({
	root: path.join(__dirname, '../../src/lib/protos'),
	file: 'common/common.proto'
}).common;

const _proposalProto = grpc.load({
	root: path.join(__dirname, '../../src/lib/protos'),
	file: 'peer/proposal.proto'
}).protos;

const _timestampProto = grpc.load({
	root: path.join(__dirname, '../../src/lib/protos'),
	file: 'google/protobuf/timestamp.proto'
}).google.protobuf;

function newStub(addTransientMap, tMap) {
	// arguments from the protobuf are an array of ByteBuffer objects
	let buf1 = ByteBuffer.fromUTF8('invoke');
	let buf2 = ByteBuffer.fromUTF8('someKey');
	let buf3 = ByteBuffer.fromUTF8('someValue');

	return new Stub(
		'dummyClient',
		'dummyChanelId',
		'dummyTxid',
		{
			args: [buf1, buf2, buf3]
		},
		{
			proposal_bytes: newProposal(addTransientMap, tMap).toBuffer()
		});
}

function newProposal(addTransientMap, tMap) {
	let creator = new _idProto.SerializedIdentity();
	creator.setMspid('dummyMSPId');

	let signatureHeader = new _commonProto.SignatureHeader();
	signatureHeader.setCreator(creator.toBuffer());
	signatureHeader.setNonce(Buffer.from('12345'));

	let cHeader = new _commonProto.ChannelHeader();
	cHeader.setEpoch(10);
	cHeader.setTimestamp(buildTimeStamp());

	let header = new _commonProto.Header();
	header.setSignatureHeader(signatureHeader.toBuffer());
	header.setChannelHeader(cHeader.toBuffer());

	let ccpayload = new _proposalProto.ChaincodeProposalPayload();
	ccpayload.setInput(Buffer.from('dummyChaincodeInput'));
	if (addTransientMap) {
		if (tMap)
			ccpayload.setTransientMap(tMap);
		else
			ccpayload.setTransientMap({'testKey': Buffer.from('testValue')});
	}

	let sp = new _proposalProto.Proposal();
	sp.setHeader(header.toBuffer());
	sp.setPayload(ccpayload.toBuffer());

	return sp;
}

function buildTimeStamp() {
	var now = new Date();
	var timestamp = new _timestampProto.Timestamp();
	timestamp.setSeconds(now.getTime() / 1000);
	timestamp.setNanos((now.getTime() % 1000) * 1000000);
	return timestamp;
}

module.exports = {
	newStub: newStub,
	newProposal: newProposal
};