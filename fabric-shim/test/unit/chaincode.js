/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
/*global describe it beforeEach afterEach before after */
'use strict';

const sinon = require('sinon');
const chai = require('chai');
const expect = chai.expect;
const rewire = require('rewire');
const grpc = require('grpc');
const path = require('path');

const Logger = require('../../../fabric-shim/lib/logger');

const chaincodePath = '../../../fabric-shim/lib/chaincode.js';

const _serviceProto = grpc.load({
	root: path.join(__dirname, '../../../fabric-shim/lib/protos'),
	file: 'peer/chaincode_shim.proto'
}).protos;

describe('Chaincode', () => {

	describe('Chaincode \'spi\' interface',()=>{
		it ('should be able to call the init method',()=>{
			let Chaincode = new (require(chaincodePath).ChaincodeInterface)();
			Chaincode.Init();
		});

		it ('should be able to call the init method',()=>{
			let Chaincode = new (require(chaincodePath).ChaincodeInterface)();
			Chaincode.Invoke();
		});
		it('should only have the Init and Invoke',()=>{
			let Chaincode = new (require(chaincodePath).ChaincodeInterface)();
			const propNames = Object.getOwnPropertyNames(Object.getPrototypeOf(Chaincode));

			expect(propNames.length).to.eql(3);
			expect(propNames).to.have.members(['constructor','Init','Invoke']);
		});
	});

	describe('Command line arguments', () => {
		it ('should return undefined for zero argument', () => {
			let Chaincode = rewire(chaincodePath);
			let opts = Chaincode.__get__('opts');

			expect(opts['peer.address']).to.be.an('undefined');
		});

		it ('should set value when peer.address argument set, and default others', () => {
			process.argv.push('--peer.address');
			process.argv.push('localhost:7051');
			delete require.cache[require.resolve(chaincodePath)];
			let Chaincode = rewire(chaincodePath);
			let opts = Chaincode.__get__('opts');

			expect(opts['peer.address']).to.deep.equal('localhost:7051');
			expect(opts['grpc.max_send_message_length']).to.equal(-1);
			expect(opts['grpc.max_receive_message_length']).to.equal(-1);
			expect(opts['grpc.keepalive_time_ms']).to.equal(110000);
			expect(opts['grpc.http2.min_time_between_pings_ms']).to.equal(110000);
			expect(opts['grpc.keepalive_timeout_ms']).to.equal(20000);
			expect(opts['grpc.keepalive_permit_without_calls']).to.equal(1);
			expect(opts['grpc.http2.max_pings_without_data']).to.equal(0);

			process.argv.pop();
			process.argv.pop();
		});

		it ('should ignore non expected arguments arguments', () => {
			process.argv.push('--peer.address');
			process.argv.push('localhost:7051');
			process.argv.push('--test.again');
			process.argv.push('dummyValue9');

			delete require.cache[require.resolve(chaincodePath)];
			let Chaincode = rewire(chaincodePath);
			let opts = Chaincode.__get__('opts');

			expect(opts['peer.address']).to.deep.equal('localhost:7051');
			expect(opts['test.again']).to.be.an('undefined');

			for (let index = 0; index < 4; index++) {
				process.argv.pop();
			}
		});

		it ('should be possible to change the default CLI values', () => {
			process.argv.push('--peer.address');
			process.argv.push('localhost:7051');
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

			delete require.cache[require.resolve(chaincodePath)];
			let Chaincode = rewire(chaincodePath);
			let opts = Chaincode.__get__('opts');

			expect(opts['peer.address']).to.deep.equal('localhost:7051');
			expect(opts['grpc.max_send_message_length']).to.equal(101);
			expect(opts['grpc.max_receive_message_length']).to.equal(177);
			expect(opts['grpc.keepalive_time_ms']).to.equal(1234);
			expect(opts['grpc.http2.min_time_between_pings_ms']).to.equal(7654);
			expect(opts['grpc.keepalive_timeout_ms']).to.equal(5678);
			expect(opts['grpc.keepalive_permit_without_calls']).to.equal(2);
			expect(opts['grpc.http2.max_pings_without_data']).to.equal(99);

			for (let index = 0; index < 16; index++) {
				process.argv.pop();
			}
		});
	});

	describe('Start()', () => {
		let Chaincode;

		beforeEach(() => {
			Chaincode = rewire(chaincodePath);
		});

		it ('should throw an error if no arguments passed', () => {
			expect(() => {
				Chaincode.start();
			}).to.throw(/Missing required argument: chaincode/);
		});

		it ('should throw an error if string argument passed', () => {
			expect(() => {
				Chaincode.start('fakeChaincodeClass');
			}).to.throw(/Missing required argument: chaincode/);
		});

		it ('should throw an error if null argument passed', () => {
			expect(() => {
				Chaincode.start(null);
			}).to.throw(/Missing required argument: chaincode/);
		});

		it ('should throw an error if object missing init passed as argument', () => {
			expect(() => {
				Chaincode.start({});
			}).to.throw(/The "chaincode" argument must implement the "Init\(\)" method/);
		});

		it ('should throw an error if object missing invoke passed as argument', () => {
			expect(() => {
				Chaincode.start({
					Init: () => {}
				});
			}).to.throw(/The "chaincode" argument must implement the "Invoke\(\)" method/);
		});

		it ('should start when passed init and invoke', () => {
			let handlerClass = Chaincode.__get__('Handler');
			let chat = sinon.stub(handlerClass.prototype, 'chat');

			Chaincode.__set__('opts', {'peer.address': 'localhost:7051'});
			process.env.CORE_CHAINCODE_ID_NAME = 'mycc';

			Chaincode.start({Init: function() {}, Invoke: function() {}});

			expect(chat.calledOnce).to.be.ok;

			let args = chat.firstCall.args;
			expect(args.length).to.deep.equal(1);
			expect(typeof args[0]).to.deep.equal('object');
			expect(args[0].type).to.deep.equal(_serviceProto.ChaincodeMessage.Type.REGISTER);

			chat.restore();
			delete process.env.CORE_CHAINCODE_ID_NAME;
		});

		describe('TLS handling', () => {
			let Chaincode = rewire(chaincodePath);

			let testfile = path.join(__dirname, '../../../package.json');

			Chaincode.__set__('opts', {'peer.address': 'localhost:7051'});

			before(() => {
				process.env.CORE_CHAINCODE_ID_NAME = 'mycc';
				process.env.CORE_PEER_TLS_ENABLED = true;
				process.env.CORE_PEER_TLS_ROOTCERT_FILE = testfile;
			});

			afterEach(() => {
				delete process.env.CORE_TLS_CLIENT_KEY_PATH;
				delete process.env.CORE_TLS_CLIENT_CERT_PATH;
			});

			after(() => {
				delete process.env.CORE_CHAINCODE_ID_NAME;
				delete process.env.CORE_PEER_TLS_ENABLED;
				delete process.env.CORE_PEER_TLS_ROOTCERT_FILE;
			});

			it ('should throw an error when CORE_TLS_CLIENT_KEY_PATH env var not set', () => {
				expect(() => {
					Chaincode.start({Init: function() {}, Invoke: function() {}});
				}).to.throw(/The client key and cert are needed when TLS is enabled, but environment variables specifying the paths to these files are missing/);
			});

			it ('should throw an error when CORE_TLS_CLIENT_KEY_PATH env var set but CORE_TLS_CLIENT_CERT_PATH env var not set', () => {
				process.env.CORE_TLS_CLIENT_KEY_PATH = testfile;
				expect(() => {
					Chaincode.start({Init: function() {}, Invoke: function() {}});
				}).to.throw(/The client key and cert are needed when TLS is enabled, but environment variables specifying the paths to these files are missing/);
			});

			it ('should call handler.chat() with the correct object and output a message', () => {

				let handlerClass = Chaincode.__get__('Handler');
				let chat = sinon.stub(handlerClass.prototype, 'chat');

				process.env.CORE_TLS_CLIENT_KEY_PATH = testfile;
				process.env.CORE_TLS_CLIENT_CERT_PATH = testfile;

				Chaincode.start({Init: function() {}, Invoke: function() {}});

				expect(chat.calledOnce).to.be.ok;

				let args = chat.firstCall.args;
				expect(args.length).to.deep.equal(1);
				expect(typeof args[0]).to.deep.equal('object');
				expect(args[0].type).to.deep.equal(_serviceProto.ChaincodeMessage.Type.REGISTER);

				chat.restore();
			});

			it ('should load the opts certificate attributes as JSON strings with the correct properties', () => {
				let handlerClass = Chaincode.__get__('Handler');
				let chat = sinon.stub(handlerClass.prototype, 'chat');

				process.env.CORE_TLS_CLIENT_KEY_PATH = testfile;
				process.env.CORE_TLS_CLIENT_CERT_PATH = testfile;

				Chaincode.start({Init: function() {}, Invoke: function() {}});

				let opts = Chaincode.__get__('opts');

				let attributes = ['pem', 'cert', 'key'];

				attributes.forEach((attr) => {
					expect(typeof opts[attr]).to.deep.equal('string');

					let json = JSON.parse(opts[attr]);
					expect(json.name).to.deep.equal('fabric-shim-test');
				});

				chat.restore();
			});
		});
	});

	describe('parsePeerUrlFcn' ,() => {
		let parsePeerUrlFcn;
		let Chaincode = rewire(chaincodePath);

		beforeEach(() => {
			parsePeerUrlFcn = Chaincode.__get__('parsePeerUrl');
		});

		it ('should throw an error if peer.address not set', () => {
			expect(() => {
				parsePeerUrlFcn();
			}).to.throw(/The "peer.address" program argument must be set to a legitimate value of/);
		});

		it ('should throw an error if peer.address set to url', () => {
			expect(() => {
				parsePeerUrlFcn('http://dummyUrl');
			}).to.throw(/The "peer.address" program argument can not be set to an "http\(s\)" url/);
		});

		it ('should use grpc when URL already has that prefix', () => {
			expect(parsePeerUrlFcn('grpc://localhost:7051')).to.deep.equal('grpc://localhost:7051');
		});

		it ('should use grpcs when URL already has that prefix', () => {
			expect(parsePeerUrlFcn('grpcs://localhost:7051')).to.deep.equal('grpcs://localhost:7051');
		});

		it ('should use grpc when CORE_PEER_TLS_ENABLED env var is not set', () => {
			process.env.CORE_PEER_TLS_ENABLED = undefined;
			expect(parsePeerUrlFcn('localhost:7051')).to.deep.equal('grpc://localhost:7051');
		});

		it ('should use grpc when CORE_PEER_TLS_ENABLED env var is set to false', () => {
			process.env.CORE_PEER_TLS_ENABLED = false;
			expect(parsePeerUrlFcn('localhost:7051')).to.deep.equal('grpc://localhost:7051');
		});

		it ('should use grpc when CORE_PEER_TLS_ENABLED env var is set to a string FALSE', () => {
			process.env.CORE_PEER_TLS_ENABLED = 'FALSE';
			expect(parsePeerUrlFcn('localhost:7051')).to.deep.equal('grpc://localhost:7051');
		});

		it ('should use grpcs when CORE_PEER_TLS_ENABLED env var is set to true', () => {
			process.env.CORE_PEER_TLS_ENABLED = true;
			expect(parsePeerUrlFcn('localhost:7051')).to.deep.equal('grpcs://localhost:7051');
		});

		it ('should use grpcs when CORE_PEER_TLS_ENABLED env var is set to a string TRUE', () => {
			process.env.CORE_PEER_TLS_ENABLED = 'TRUE';
			expect(parsePeerUrlFcn('localhost:7051')).to.deep.equal('grpcs://localhost:7051');
		});
	});

	describe('response', () => {
		let Chaincode;
		let respProto;
		let ChaincodeStub;
		let mockResponse;
		let saveClass;

		beforeEach(() => {
			Chaincode = rewire(chaincodePath);

			respProto = Chaincode.__get__('_responseProto');
			ChaincodeStub = Chaincode.__get__('ChaincodeStub');
			mockResponse = sinon.createStubInstance(respProto.Response);
			saveClass = respProto.Response;

			class MockResponse {
				constructor() {
					return mockResponse;
				}
			}

			respProto.Response = MockResponse;
		});

		after(() => {
			respProto.Response = saveClass;
		});

		it ('should let the code response an error', () => {
			let result = Chaincode.error('error msg');

			expect(result.message).to.deep.equal('error msg');
			expect(result.status).to.deep.equal(ChaincodeStub.RESPONSE_CODE.ERROR);
		});

		it ('should handle an empty success', () => {
			let result = Chaincode.success();

			expect(result.payload).to.deep.equal(Buffer.from(''));
			expect(result.status).to.deep.equal(ChaincodeStub.RESPONSE_CODE.OK);
		});

		it ('should handle a success with message', () => {
			let result = Chaincode.success('msg');

			expect(result.payload).to.deep.equal('msg');
			expect(result.status).to.deep.equal(ChaincodeStub.RESPONSE_CODE.OK);
		});
	});

	describe('newLogger()', () => {
		let Chaincode = rewire(chaincodePath);
		it ('should use shim when calling getLogger and no name passed', () => {
			let loggerStub = sinon.stub(Logger, 'getLogger');

			Chaincode.newLogger();

			expect(loggerStub.calledOnce).to.be.ok;
			expect(loggerStub.getCall(0).args[0]).to.deep.equal('shim');

			Logger.getLogger.restore();
		});

		it ('should use shim when calling getLogger and name passed', () => {
			let loggerStub = sinon.stub(Logger, 'getLogger');

			Chaincode.newLogger('testLogger');

			expect(loggerStub.calledOnce).to.be.ok;
			expect(loggerStub.getCall(0).args[0]).to.deep.equal('testLogger');

			Logger.getLogger.restore();
		});
	});
});
