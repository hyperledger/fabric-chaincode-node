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
const grpc = require('grpc');
const path = require('path');

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
			new Handler({
				Init: function() {},
				Invoke: function() {}
			});
		},
		/Parameter "url" must be a string/,
		'Test error handling on missing "url" argument'
	);

	t.throws(
		() => {
			new Handler({
				Init: function() {},
				Invoke: function() {}
			}, 'https://localhost:7051');
		},
		/Invalid protocol: https.  URLs must begin with grpc:\/\/ or grpcs:\/\//,
		'Test error handling on invalid "https" url argument'
	);

	let handler;
	t.doesNotThrow(
		() => {
			handler = new Handler({
				Init: function() {},
				Invoke: function() {}
			}, 'grpc://localhost:7051');
		},
		null,
		'Test positive handling of valid url argument'
	);

	t.equal(handler._endpoint.addr, 'localhost:7051', 'Test handler.addr value is properly set');
	t.equal(typeof handler._client !== 'undefined' && handler._client !== null, true, 'Test handler._client is properly set');

	t.throws(
		() => {
			new Handler({
				Init: function() {},
				Invoke: function() {}
			}, 'grpcs://localhost:7051');
		},
		/PEM encoded certificate is required/,
		'Test error handling on missing opts.pem when using grpcs://'
	);

	handler = new Handler({
		Init: function() {},
		Invoke: function() {}
	}, 'grpcs://localhost:7051',
	{
		'pem': 'dummyPEMString',
		'ssl-target-name-override': 'dummyHost',
		'request-timeout': 12345,
		'another-property': 'dummyValue'
	});

	t.equal(handler._options['grpc.ssl_target_name_override'], 'dummyHost', 'Test converting opts.ssl-target-name-override to grpc.ssl_target_name_override');
	t.equal(handler._options['grpc.default_authority'], 'dummyHost', 'Test converting opts.ssl-target-name-override to grpc.default_authority');
	t.equal(handler._options['request-timeout'], 12345, 'Test processing request-time option');
	t.equal(handler._options['another-property'], 'dummyValue', 'Test processing another-property option');

	t.end();
});