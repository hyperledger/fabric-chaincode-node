/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const test = require('../base.js');
const sinon = require('sinon');
const rewire = require('rewire');
const grpc = require('grpc');
const path = require('path');

const Chaincode = rewire('fabric-shim/lib/chaincode.js');
const Handler = rewire('fabric-shim/lib/handler.js');

const _serviceProto = grpc.load({
	root: path.join(__dirname, '../../src/lib/protos'),
	file: 'peer/chaincode_shim.proto'
}).protos;

test('chaincode start() tests', (t) => {
	let sandbox = sinon.sandbox.create();
	t.throws(
		() => {
			Chaincode.start();
		},
		/Missing required argument: chaincode/,
		'Test without any arguments'
	);
	t.throws(
		() => {
			Chaincode.start('fakeChaincodeClass');
		},
		/Missing required argument: chaincode/,
		'Test with a string argument for the chaincode class'
	);

	t.throws(
		() => {
			Chaincode.start(null);
		},
		/Missing required argument: chaincode/,
		'Test with a null value for the chaincode class'
	);

	t.throws(
		() => {
			Chaincode.start({});
		},
		/The "chaincode" argument must implement the "Init\(\)" method/,
		'Test with an object without the Init() method'
	);

	t.throws(
		() => {
			Chaincode.start({Init: function() {}});
		},
		/The "chaincode" argument must implement the "Invoke\(\)" method/,
		'Test with an object without the Invoke() method'
	);

	let parsePeerUrlFcn = Chaincode.__get__('parsePeerUrl');

	t.throws(
		() => {
			parsePeerUrlFcn();
		},
		/The "peer.address" program argument must be set to a legitimate value of/,
		'Test peer url parsing without an argument'
	);

	t.throws(
		() => {
			parsePeerUrlFcn('http://dummyUrl');
		},
		/The "peer.address" program argument can not be set to an "http\(s\)" url/,
		'Test peer url parsing with an http:// value'
	);

	t.throws(
		() => {
			parsePeerUrlFcn('http://dummyUrl');
		},
		/The "peer.address" program argument can not be set to an "http\(s\)" url/,
		'Test peer url parsing with an http:// value'
	);

	process.env.CORE_PEER_TLS_ENABLED = true;
	let url = parsePeerUrlFcn('localhost:7051');
	t.equal(url, 'grpcs://localhost:7051', 'Test appending grpcs:// when CORE_PEER_TLS_ENABLED env var is set to true');

	process.env.CORE_PEER_TLS_ENABLED = 'TRUE';
	url = parsePeerUrlFcn('localhost:7051');
	t.equal(url, 'grpcs://localhost:7051', 'Test appending grpcs:// when CORE_PEER_TLS_ENABLED env var is set to TRUE');

	process.env.CORE_PEER_TLS_ENABLED = false;
	url = parsePeerUrlFcn('localhost:7051');
	t.equal(url, 'grpc://localhost:7051', 'Test appending grpcs:// when CORE_PEER_TLS_ENABLED env var is set to false');

	process.env.CORE_PEER_TLS_ENABLED = 'FALSE';
	url = parsePeerUrlFcn('localhost:7051');
	t.equal(url, 'grpc://localhost:7051', 'Test appending grpcs:// when CORE_PEER_TLS_ENABLED env var is set to FALSE');

	// stub out the Handler.chat() method so it doesn't send
	// out gRPC calls
	let handlerClass = Chaincode.__get__('Handler');
	let chat = sandbox.stub(handlerClass.prototype, 'chat');
	// set a proper value to the module-scoped variable
	// that will be used by the "start()" method tested below
	Chaincode.__set__('opts', {'peer.address': 'localhost:7051'});
	process.env.CORE_CHAINCODE_ID_NAME = 'mycc';
	let handler = Chaincode.start({Init: function() {}, Invoke: function() {}});
	t.equal(chat.calledOnce, true, 'Test handler.chat() gets called on legit shim.start() invocation');
	let args = chat.firstCall.args;
	t.equal(args.length === 1 && typeof args[0] === 'object', true, 'Test handler.chat() gets called with one object');
	t.equal(args[0].type, _serviceProto.ChaincodeMessage.Type.REGISTER, 'Test the argument has the right message type');
	handler.close();
	sandbox.restore();
	t.end();

});