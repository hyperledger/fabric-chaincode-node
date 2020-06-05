/*
# Copyright Hitachi America, Ltd. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const sinon = require('sinon');

const chai = require('chai');
const expect = chai.expect;

const yargs = require('yargs');
const Bootstrap = require('../../../lib/contract-spi/bootstrap');
const chaincodeServerCommand = require('../../../lib/cmds/serverCommand.js');

describe('server cmd', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('.builder', () => {
        it('should configure the builder function', () => {
            sandbox.stub(yargs, 'options');
            sandbox.stub(yargs, 'usage');

            chaincodeServerCommand.builder(yargs);

            expect(yargs.options.calledOnce).to.be.true;

            const args = yargs.options.getCall(0).args[0];

            expect(args['chaincode-address'].required).to.be.true;
            expect(args['chaincode-id'].required).to.be.true;
            expect(args['grpc.max_send_message_length'].default).to.deep.equal(-1);
            expect(args['grpc.max_receive_message_length'].default).to.deep.equal(-1);
            expect(args['grpc.keepalive_time_ms'].default).to.deep.equal(110000);
            expect(args['grpc.http2.min_time_between_pings_ms'].default).to.deep.equal(110000);
            expect(args['grpc.keepalive_timeout_ms'].default).to.deep.equal(20000);
            expect(args['grpc.http2.max_pings_without_data'].default).to.deep.equal(0);
            expect(args['grpc.keepalive_permit_without_calls'].default).to.deep.equal(1);
            expect(args['module-path'].default).to.deep.equal(process.cwd());

            expect(yargs.usage.calledOnce).to.be.true;
        });
    });

    describe('.handle', () => {
        it('should handle properly and call bootstrap', () => {
            sandbox.stub(Bootstrap, 'bootstrap');

            const argv = {};
            chaincodeServerCommand.handler(argv);

            expect(Bootstrap.bootstrap.calledOnce).to.be.true;
        });
    });

    describe('.getArgs', () => {
        it('should return the arguments properly', () => {
            const argv = {
                'chaincode-address': '0.0.0.0:9999',
                'chaincode-id': 'test_id:1',
                'grpc.keepalive_time_ms': 1000,
                'module-path': '/tmp/example',
                'extra-options': 'something'
            };

            const ret = chaincodeServerCommand.getArgs({argv});

            expect(ret.address).to.equal('0.0.0.0:9999');
            expect(ret.ccid).to.equal('test_id:1');
            expect(ret['grpc.keepalive_time_ms']).to.equal(1000);
            expect(ret['module-path']).to.equal('/tmp/example');
            expect(ret['chaincode-address']).to.be.undefined;
            expect(ret['chaincode-id']).to.be.undefined;
            expect(ret['extra-options']).to.be.undefined;
        });
    });
});
