/*
# Copyright Hitachi America, Ltd. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const sinon = require('sinon');

const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const path = require('path');

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
            sandbox.stub(yargs, 'check');

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
            expect(yargs.check.calledOnce).to.be.true;
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
        const certFileEncoded = path.join(__dirname, '..', 'test-cert.base64');
        const keyFileEncoded = path.join(__dirname, '..', 'test-key.base64');
        const caFileEncoded = path.join(__dirname, '..', 'test-ca.base64');
        const certFile = path.join(__dirname, '..', 'test-cert.pem');
        const keyFile = path.join(__dirname, '..', 'test-key.pem');
        const caFile = path.join(__dirname, '..', 'test-ca.pem');
        const cert = Buffer.from(fs.readFileSync(certFileEncoded).toString(), 'base64');
        const key = Buffer.from(fs.readFileSync(keyFileEncoded).toString(), 'base64');
        const ca = Buffer.from(fs.readFileSync(caFileEncoded).toString(), 'base64');

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

        it('should return the TLS arguments properly', () => {
            const argv = {
                'chaincode-address': '0.0.0.0:9999',
                'chaincode-id': 'test_id:1',
                'module-path': '/tmp/example',
                'chaincode-tls-cert-path': certFileEncoded,
                'chaincode-tls-key-path': keyFileEncoded
            };

            const ret = chaincodeServerCommand.getArgs({argv});

            expect(ret.address).to.equal('0.0.0.0:9999');
            expect(ret.ccid).to.equal('test_id:1');

            expect(ret.tlsProps).to.deep.equal({
                cert,
                key
            });
        });

        it('should return the mutual TLS arguments properly', () => {
            const argv = {
                'chaincode-address': '0.0.0.0:9999',
                'chaincode-id': 'test_id:1',
                'module-path': '/tmp/example',
                'chaincode-tls-cert-path': certFileEncoded,
                'chaincode-tls-key-path': keyFileEncoded,
                'chaincode-tls-client-cacert-path': caFileEncoded
            };

            const ret = chaincodeServerCommand.getArgs({argv});

            expect(ret.address).to.equal('0.0.0.0:9999');
            expect(ret.ccid).to.equal('test_id:1');

            expect(ret.tlsProps).to.deep.equal({
                cert,
                key,
                clientCACerts: ca
            });
        });

        it('should return the TLS arguments with PEM files properly', () => {
            const argv = {
                'chaincode-address': '0.0.0.0:9999',
                'chaincode-id': 'test_id:1',
                'module-path': '/tmp/example',
                'chaincode-tls-cert-file': certFile,
                'chaincode-tls-key-file': keyFile,
                'chaincode-tls-client-cacert-file': caFile
            };

            const ret = chaincodeServerCommand.getArgs({argv});

            expect(ret.address).to.equal('0.0.0.0:9999');
            expect(ret.ccid).to.equal('test_id:1');

            expect(ret.tlsProps).to.deep.equal({
                cert,
                key,
                clientCACerts: ca
            });
        });
    });

    describe('parse arguments', () => {
        it('should parse the arguments successfully', () => {
            expect(() => {
                chaincodeServerCommand.builder(yargs)
                    .exitProcess(false)
                    .parse('--chaincode-id test_id:1 --chaincode-address 0.0.0.0:9999');
            }).not.to.throw();
        });

        it('should parse the arguments successfully with TLS options', () => {
            expect(() => {
                chaincodeServerCommand.builder(yargs)
                    .exitProcess(false)
                    .parse('--chaincode-id test_id:1 --chaincode-address 0.0.0.0:9999 ' +
                        '--chaincode-tls-key-file tls.key --chaincode-tls-cert-file tls.pem');
            }).not.to.throw();
        });

        it('should throw when conflicting arguments are passed', () => {
            expect(() => {
                chaincodeServerCommand.builder(yargs)
                    .exitProcess(false)
                    .parse('--chaincode-id test_id:1 --chaincode-address 0.0.0.0:9999 ' +
                        '--chaincode-tls-key-file tls.key --chaincode-tls-key-path tls.pem');
            }).to.throw();
        });

        it('should throw when only TLS key is passed', () => {
            expect(() => {
                chaincodeServerCommand.builder(yargs)
                    .exitProcess(false)
                    .parse('--chaincode-id test_id:1 --chaincode-address 0.0.0.0:9999 ' +
                        '--chaincode-tls-key-file tls.key');
            }).to.throw();
        });

        it('should throw when only TLS cert is passed', () => {
            expect(() => {
                chaincodeServerCommand.builder(yargs)
                    .exitProcess(false)
                    .parse('--chaincode-id test_id:1 --chaincode-address 0.0.0.0:9999 ' +
                        '--chaincode-tls-cert-file tls.pem');
            }).to.throw();
        });
    });
});
