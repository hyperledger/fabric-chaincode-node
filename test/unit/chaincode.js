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
const util = require('util');

const _serviceProto = grpc.load({
	root: path.join(__dirname, '../../src/lib/protos'),
	file: 'peer/chaincode_shim.proto'
}).protos;

let Chaincode;

test('Chaincode command line arguments tests', (t) => {
	Chaincode = rewire('fabric-shim/lib/chaincode.js');
	let opts = Chaincode.__get__('opts');
	t.deepEqual(opts['peer.address'], undefined, 'Test zero argument');

	process.argv.push('--peer.address');
	process.argv.push('localhost:7051');
	delete require.cache[require.resolve('fabric-shim/lib/chaincode.js')];
	Chaincode = rewire('fabric-shim/lib/chaincode.js');
	opts = Chaincode.__get__('opts');
	t.deepEqual(opts['peer.address'], 'localhost:7051', 'Test passing only --peer.address argument is correctly picked up');
	t.equal(opts['grpc.max_send_message_length'], -1, 'Test grpc.max_send_message_length defaults to -1');
	t.equal(opts['grpc.max_receive_message_length'], -1, 'Test grpc.max_receive_message_length defaults to -1');
	t.equal(opts['grpc.keepalive_time_ms'], 110000, 'Test grpc.keepalive_time_ms defaults to 110000');
	t.equal(opts['grpc.http2.min_time_between_pings_ms'], 110000, 'Test grpc.http2.min_time_between_pings_ms defaults to 110000');
	t.equal(opts['grpc.keepalive_timeout_ms'], 20000, 'Test grpc.keepalive_timeout_ms defaults to 20000');
	t.equal(opts['grpc.http2.max_pings_without_data'], 0, 'Test grpc.http2.max_pings_without_data defaults to 0');
	t.equal(opts['grpc.keepalive_permit_without_calls'], 1, 'Test grpc.keepalive_permit_without_calls defaults to 1');

	process.argv.push('--test.another');
	process.argv.push('dummyValue9');
	delete require.cache[require.resolve('fabric-shim/lib/chaincode.js')];
	Chaincode = rewire('fabric-shim/lib/chaincode.js');
	opts = Chaincode.__get__('opts');
	t.deepEqual(opts['peer.address'], 'localhost:7051', 'Test passing two arguments and one is in the parsing definition');
	t.deepEqual(opts['test.another'], undefined, 'Test passing two arguments and one is NOT in the parsing definition');

	process.argv.pop();  // remove dummyValu9
	process.argv.pop();  // remove test.another

	process.argv.push('--grpc.max_send_message_length');
	process.argv.push('101');
	process.argv.push('--grpc.max_receive_message_length');
	process.argv.push('177');
	process.argv.push('--grpc.keepalive_time_ms');
	process.argv.push('1234');
	process.argv.push('--grpc.keepalive_timeout_ms');
	process.argv.push('5678');
	process.argv.push('--grpc.http2.min_time_between_pings_ms');
	process.argv.push('7654');
	process.argv.push('--grpc.http2.max_pings_without_data');
	process.argv.push('99');
	process.argv.push('--grpc.keepalive_permit_without_calls');
	process.argv.push('2');
	delete require.cache[require.resolve('fabric-shim/lib/chaincode.js')];
	Chaincode = rewire('fabric-shim/lib/chaincode.js');
	opts = Chaincode.__get__('opts');
	t.deepEqual(opts['peer.address'], 'localhost:7051', 'Test passing only --peer.address argument is correctly picked up');
	t.equal(opts['grpc.max_send_message_length'],101, 'Test grpc.max_send_message_length can be set');
	t.equal(opts['grpc.max_receive_message_length'], 177, 'Test grpc.max_receive_message_length can be set');
	t.equal(opts['grpc.keepalive_time_ms'], 1234, 'Test grpc.keepalive_time_ms can be set');
	t.equal(opts['grpc.http2.min_time_between_pings_ms'], 7654, 'Test grpc.http2.min_time_between_pings_ms can be set');
	t.equal(opts['grpc.keepalive_timeout_ms'], 5678, 'Test grpc.keepalive_timeout_ms can be set');
	t.equal(opts['grpc.http2.max_pings_without_data'], 99, 'Test grpc.http2.max_pings_without_data can be set');
	t.equal(opts['grpc.keepalive_permit_without_calls'], 2, 'Test grpc.keepalive_permit_without_calls can be set');

	// remove the 7 parameters passed
	for (let index = 0; index < 7; index++) {
		process.argv.pop();
		process.argv.pop();
	}

	process.argv.pop();  // remove localhost:7051
	process.argv.pop();  // remove peer.address
	t.end();
});

Chaincode = rewire('fabric-shim/lib/chaincode.js');

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
	process.env.CORE_PEER_TLS_ENABLED = true;
	// use package.json in the place of the cert so it's easy to verify it's been properly loaded
	let testfile = path.join(__dirname, '../../package.json');
	process.env.CORE_PEER_TLS_ROOTCERT_FILE = testfile;

	t.throws(
		() => {
			Chaincode.start({Init: function() {}, Invoke: function() {}});
		},
		/The client key and cert are needed when TLS is enabled, but environment variables specifying the paths to these files are missing/,
		'Test verifying environment variables for TLS client key and cert'
	);

	process.env.CORE_TLS_CLIENT_KEY_PATH = testfile;

	t.throws(
		() => {
			Chaincode.start({Init: function() {}, Invoke: function() {}});
		},
		/The client key and cert are needed when TLS is enabled, but environment variables specifying the paths to these files are missing/,
		'Test verifying environment variables for TLS client key'
	);

	process.env.CORE_TLS_CLIENT_CERT_PATH = testfile;

	// now have the chaincode shim process all the above during bootstrap and verify the result
	let handler = Chaincode.start({Init: function() {}, Invoke: function() {}});
	t.equal(chat.calledOnce, true, 'Test handler.chat() gets called on legit shim.start() invocation');
	let args = chat.firstCall.args;
	t.equal(args.length === 1 && typeof args[0] === 'object', true, 'Test handler.chat() gets called with one object');
	t.equal(args[0].type, _serviceProto.ChaincodeMessage.Type.REGISTER, 'Test the argument has the right message type');

	let opts = Chaincode.__get__('opts');
	let testFcn = function(t, attr) {
		t.equal(typeof opts[attr], 'string', util.format('Test the opts attribute "%s" has been properly loaded as string', attr));
		let pkg = JSON.parse(opts[attr]);
		t.equal(typeof pkg.name, 'string', util.format('Test the opts attribute "%s" content has a "name" property', attr));
		t.equal(pkg.name, 'fabric-shim-test', util.format('Test the opts attribute "%s" content has the expected value', attr));
	};

	testFcn(t, 'pem');
	testFcn(t, 'key');
	testFcn(t, 'cert');
	sandbox.restore();
	t.end();

});

test('shim error tests', (t) => {
	let respProto = Chaincode.__get__('_responseProto');
	let Stub = Chaincode.__get__('Stub');
	let mockResponse = sinon.createStubInstance(respProto.Response);
	let saveClass = respProto.Response;
	class MockResponse {
		constructor() {
			return mockResponse;
		}
	}
	respProto.Response = MockResponse;
	let result = Chaincode.error('error msg');
	t.equal(result.message, 'error msg', 'Test the message is set to error message');
	t.equal(result.status, Stub.RESPONSE_CODE.ERROR, 'Test the status is set correctly');

	respProto.Response = saveClass;
	t.end();
});

test('shim success tests', (t) => {
	let respProto = Chaincode.__get__('_responseProto');
	let Stub = Chaincode.__get__('Stub');
	let mockResponse = sinon.createStubInstance(respProto.Response);
	let saveClass = respProto.Response;
	class MockResponse {
		constructor() {
			return mockResponse;
		}
	}
	respProto.Response = MockResponse;
	let result = Chaincode.success('msg');
	t.equal(result.payload, 'msg', 'Test the message is set to error message');
	t.equal(result.status, Stub.RESPONSE_CODE.OK, 'Test the status is set correctly');

	result = Chaincode.success();
	t.deepEqual(result.payload, Buffer.from(''), 'Test the message is set to error message');
	t.equal(result.status, Stub.RESPONSE_CODE.OK, 'Test the status is set correctly');


	respProto.Response = saveClass;
	t.end();
});

test('shim newLogger() tests', (t) => {
	let oldValue = process.env['CORE_CHAINCODE_LOGGING_SHIM'];
	process.env['CORE_CHAINCODE_LOGGING_SHIM'] = 'CRITICAL';
	let logger = Chaincode.newLogger('testLogger');
	t.equal(logger.level, 'fatal', 'Test logger level is properly set according to the env variable CORE_CHAINCODE_LOGGING_SHIM');
	t.equal(typeof logger.info, 'function', 'Test returned logger has an info() method');

	process.env['CORE_CHAINCODE_LOGGING_SHIM'] = oldValue;
	t.end();
});
