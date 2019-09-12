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

/* global describe it beforeEach afterEach */

'use strict';

const sinon = require('sinon');

const chai = require('chai');
const expect = chai.expect;
const rewire = require('rewire');

const yargs = require('yargs');
const Bootstrap = require('../../../lib/contract-spi/bootstrap');
const chaincodeStartCommand = rewire('../../../lib/cmds/startCommand.js');

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

        const args = yargs.options.getCall(0).args[0];

        expect(args['peer.address'].required).to.be.true;
        expect(args['chaincode-id-name'].required).to.be.true;
        expect(args['grpc.max_send_message_length'].default).to.deep.equal(-1);
        expect(args['grpc.max_receive_message_length'].default).to.deep.equal(-1);
        expect(args['grpc.keepalive_time_ms'].default).to.deep.equal(110000);
        expect(args['grpc.http2.min_time_between_pings_ms'].default).to.deep.equal(110000);
        expect(args['grpc.keepalive_timeout_ms'].default).to.deep.equal(20000);
        expect(args['grpc.http2.max_pings_without_data'].default).to.deep.equal(0);
        expect(args['grpc.keepalive_permit_without_calls'].default).to.deep.equal(1);
        expect(args['module-path'].default).to.deep.equal(process.cwd());

        sinon.assert.calledOnce(yargs.usage);
    });

    it ('should handle correctly', () => {
        sandbox.stub(Bootstrap, 'bootstrap');

        const argv = {};

        chaincodeStartCommand.handler(argv);

        sinon.assert.calledOnce(Bootstrap.bootstrap);
    });

    describe('#getArgs', () => {
        it ('should return yargs when called via cli name', () => {
            const myYargs = {
                argv: {
                    $0: 'fabric-chaincode-node',
                    someArg: 'hello world'
                },
            };

            expect(chaincodeStartCommand.getArgs(myYargs)).to.deep.equal({
                $0: 'fabric-chaincode-node',
                someArg: 'hello world'
            });
        });

        it ('should use yargs parser on process.argv when not called with cli name', () => {
            const myYargs = {
                argv: {
                    $0: 'index.js',
                    someArg: 'hello world'
                },
            };

            const mockYargsParser = sinon.stub().returns({
                chaincodeIdName: 'Jeremy',
                modulePath: '/home/andy/my/super/contract',
                'peer.address': 'some addr'
            });

            const yp = chaincodeStartCommand.__get__('YargsParser');
            chaincodeStartCommand.__set__('YargsParser', mockYargsParser);

            process.argv = ['node', 'test.js', '--peer.address', 'localhost:7051', '--chaincode-id-name', 'mycc'];

            const args = chaincodeStartCommand.getArgs(myYargs);

            sinon.assert.calledOnce(mockYargsParser);
            sinon.assert.calledWith(mockYargsParser, ['--peer.address', 'localhost:7051', '--chaincode-id-name', 'mycc'], {
                default: {
                    'grpc.max_send_message_length': -1,
                    'grpc.max_receive_message_length': -1,
                    'grpc.keepalive_time_ms': 110000,
                    'grpc.http2.min_time_between_pings_ms': 110000,
                    'grpc.keepalive_timeout_ms': 20000,
                    'grpc.http2.max_pings_without_data': 0,
                    'grpc.keepalive_permit_without_calls': 1,
                    'module-path': process.cwd()
                },
                configuration: {
                    'dot-notation': false
                },
                envPrefix: 'CORE'
            });
            expect(args['chaincode-id-name']).to.deep.equal('Jeremy');
            expect(args['module-path']).to.deep.equal('/home/andy/my/super/contract');

            chaincodeStartCommand.__set__('YargsParser', yp);
        });

        it ('should throw an error if a required field is missing', () => {
            const myYargs = {
                argv: {
                    $0: 'index.js',
                    someArg: 'hello world'
                },
            };

            const mockYargsParser = sinon.stub().returns({
                chaincodeIdName: 'Jeremy',
                modulePath: '/home/andy/my/super/contract'
            });

            const yp = chaincodeStartCommand.__get__('YargsParser');
            chaincodeStartCommand.__set__('YargsParser', mockYargsParser);

            process.argv = ['node', 'test.js', '--chaincode-id-name', 'mycc'];

            expect(() => {
                chaincodeStartCommand.getArgs(myYargs);
            }).to.throw(/Missing required argument peer.address/);

            sinon.assert.calledOnce(mockYargsParser);
            sinon.assert.calledWith(mockYargsParser, ['--chaincode-id-name', 'mycc'], {
                default: {
                    'grpc.max_send_message_length': -1,
                    'grpc.max_receive_message_length': -1,
                    'grpc.keepalive_time_ms': 110000,
                    'grpc.http2.min_time_between_pings_ms': 110000,
                    'grpc.keepalive_timeout_ms': 20000,
                    'grpc.http2.max_pings_without_data': 0,
                    'grpc.keepalive_permit_without_calls': 1,
                    'module-path': process.cwd()
                },
                configuration: {
                    'dot-notation': false
                },
                envPrefix: 'CORE'
            });

            chaincodeStartCommand.__set__('YargsParser', yp);
        });
    });
});
