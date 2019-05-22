/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
/* global describe it */
'use strict';

const chai = require('chai');
const expect = chai.expect;

const rewire = require('rewire');
const Logger = rewire('../../../fabric-contract-api/lib/logger.js');

describe('Logger', () => {

    describe('setLevel', () => {
        it('should set the level to be as mapped', () => {
            const myLogger = {
                hello: 'world'
            };
            const myLogger2 = {
                hello: 'world'
            };

            Logger.__set__('loggers', {
                'myLogger': myLogger,
                'myLogger2':myLogger2
            });

            Logger.setLevel('DEBUG');
            expect(myLogger.level).to.equal('debug');
            expect(myLogger2.level).to.equal('debug');
        });
        after(() => {
            Logger.setLevel('INFO');
        });
    });

    describe('getLogger', () => {

        beforeEach(() => {

            Logger.__set__('loggers', {});
        });

        it ('should create a new logger name unknown', () => {
            const log = Logger.getLogger('unknown name');

            expect(log).to.be.ok;
            expect(log.level).to.deep.equal('info');
        });

        it ('should return existing logger if known name used', () => {
            const myLogger = {
                hello: 'world'
            };

            Logger.__set__('loggers', {
                'myLogger': myLogger
            });

            const log = Logger.getLogger('myLogger');
            expect(log).to.deep.equal(Object.assign(myLogger, {log: 'info'}));

            Logger.__set__('loggers', {});
        });

        it ('should set the log level to fatal when env var set to CRITICAL', () => {
            process.env.CORE_CHAINCODE_LOGGING_LEVEL = 'CRITICAL';

            const log = Logger.getLogger();

            expect(log).to.be.ok;
            expect(log.level).to.deep.equal('fatal');
        });

        it ('should set the log level to error when env var set to ERROR', () => {
            process.env.CORE_CHAINCODE_LOGGING_LEVEL = 'ERROR';

            const log = Logger.getLogger();

            expect(log).to.be.ok;
            expect(log.level).to.deep.equal('error');
        });

        it ('should set the log level to warn when env var set to WARNING', () => {
            process.env.CORE_CHAINCODE_LOGGING_LEVEL = 'WARNING';

            const log = Logger.getLogger();

            expect(log).to.be.ok;
            expect(log.level).to.deep.equal('warn');
        });

        it ('should set the log level to debug when env var set to DEBUG', () => {
            process.env.CORE_CHAINCODE_LOGGING_LEVEL = 'DEBUG';

            const log = Logger.getLogger();

            expect(log).to.be.ok;
            expect(log.level).to.deep.equal('debug');
        });

        it ('should set the log level to debug when env var set to INFO', () => {
            process.env.CORE_CHAINCODE_LOGGING_LEVEL = 'INFO';
            const log = Logger.getLogger();

            expect(log).to.be.ok;
            expect(log.level).to.deep.equal('info');
        });
    });

    describe('formatter', () => {
        it ('', () => {
            process.env.CORE_CHAINCODE_LOGGING_LEVEL = 'DEBUG';

            const log = Logger.getLogger();
            log.debug();
            log.debug('hello');
            log.debug('hello', {'one':'two'});
            log.debug('error', {error:new Error()});
            log.debug('error', {error:{message:''}});

        });

        it ('', () => {
            process.env.CORE_CHAINCODE_LOGGING_LEVEL = 'DEBUG';

            const log = Logger.getLogger('fred');
            log.debug('hello', 'fred');

        });
    });

    describe('Default logging for rejected promises', () => {
        beforeEach(() => {
            Logger.__set__('loggers', {});
        });
        it('should process unhandled rejections', () => {
            const myLogger = {
                hello: 'world'
            };

            Logger.__set__('loggers', {
                '_': myLogger
            });
            const firstTime = Logger.__get__('firstTime');
            firstTime();

        });
        it('Unhandled promise rjections', (done) => {


            const myLogger = {
                error: (...args) => {
                    expect(args).to.be.an('array');
                    expect(args).to.have.lengthOf(1);
                    expect(args[0]).to.include('Unhandled Rejection reason Error: exception! promise Promise');
                    done();
                }
            };

            Logger.__set__('loggers', {
                '_': myLogger
            });
            new Promise(() => {
                throw new Error('exception!');
            });



        });
    });
});
