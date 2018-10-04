/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*global describe it beforeEach afterEach */

'use strict';

const sinon = require('sinon');

const chai = require('chai');
const expect = chai.expect;

const yargs = require('yargs');
const Bootstrap = require('../../../lib/contract-spi/bootstrap');
const chaincodeStartCommand = require('../../../lib/cmds/startCommand.js');

describe('chaincode cmd', () => {
	let sandbox;

	beforeEach(() => {
		sandbox = sinon.sandbox.create();
	});

	afterEach(() => {
		sandbox.restore();
	});

	it ('should configure the builder function', () => {
		sandbox.stub(yargs, 'options');
		sandbox.stub(yargs, 'usage');

		chaincodeStartCommand.builder(yargs);

		sinon.assert.calledOnce(yargs.options);

		let args = yargs.options.getCall(0).args[0];

		expect(args['peer.address'].required).to.be.true;
		expect(args['chaincode-id-name'].required).to.be.true;
		expect(args['grpc.max_send_message_length'].default).to.deep.equal(-1);
		expect(args['grpc.max_receive_message_length'].default).to.deep.equal(-1);
		expect(args['grpc.keepalive_time_ms'].default).to.deep.equal(60000);
		expect(args['grpc.http2.min_time_between_pings_ms'].default).to.deep.equal(60000);
		expect(args['grpc.keepalive_timeout_ms'].default).to.deep.equal(20000);
		expect(args['grpc.http2.max_pings_without_data'].default).to.deep.equal(0);
		expect(args['grpc.keepalive_permit_without_calls'].default).to.deep.equal(1);

		sinon.assert.calledOnce(yargs.usage);
	});

	it ('should handle correctly', () => {
		sandbox.stub(Bootstrap, 'bootstrap');

		let argv = {};

		chaincodeStartCommand.handler(argv);

		sinon.assert.calledOnce(Bootstrap.bootstrap);
	});
});