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

    it('coverage', () => {
        // ensure that if the first time function is
        // called again, then it doesn't fail.
        const firstTime = Logger.__get__('firstTime');
        firstTime();

        // send in a rejected promise
        Promise.reject('__PERMITTED__');
    });

    describe('getLogger', () => {

        let logLevel;
        before(() => {
            logLevel = process.env.CORE_CHAINCODE_LOGGING_LEVEL;
        });

        after(() => {
            process.env.CORE_CHAINCODE_LOGGING_LEVEL = logLevel;
        });

        it ('should create a new logger name unknown', () => {
            process.env.CORE_CHAINCODE_LOGGING_LEVEL = null;

            const log = Logger.getLogger('unknown name');

            expect(log).to.exist;
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

            expect(log).to.exist;
            expect(log.level).to.deep.equal('fatal');
        });

        it ('should set the log level to error when env var set to ERROR', () => {
            process.env.CORE_CHAINCODE_LOGGING_LEVEL = 'ERROR';

            const log = Logger.getLogger();

            expect(log).to.exist;
            expect(log.level).to.deep.equal('error');
        });

        it ('should set the log level to warn when env var set to WARNING', () => {
            process.env.CORE_CHAINCODE_LOGGING_LEVEL = 'WARNING';

            const log = Logger.getLogger();

            expect(log).to.exist;
            expect(log.level).to.deep.equal('warn');
        });

        it ('should set the log level to debug when env var set to DEBUG', () => {
            process.env.CORE_CHAINCODE_LOGGING_LEVEL = 'DEBUG';

            const log = Logger.getLogger();

            expect(log).to.exist;
            expect(log.level).to.deep.equal('debug');
        });
    });


    describe('setLevel', () => {
        it('should update the loggers to be the level passed in', () => {
            const tempLogger = Logger.getLogger('wibble');
            Logger.setLevel('INFO');
            expect(process.env.CORE_CHAINCODE_LOGGING_LEVEL).to.equal('info');
            expect(tempLogger.level).to.equal('info');

            Logger.setLevel('DeBuG');
            expect(process.env.CORE_CHAINCODE_LOGGING_LEVEL).to.equal('debug');
            expect(tempLogger.level).to.equal('debug');
        });
    });

    describe('formatter', () => {
        it ('anonymous logger', () => {
            process.env.CORE_CHAINCODE_LOGGING_LEVEL = 'DEBUG';

            const log = Logger.getLogger();
            log.debug();
            log.debug('hello');
            log.debug('hello', {'one':'two'});

            // fake up possible errors being logged
            log.debug('failure', {error:new Error('Failure')});
            log.debug('failure-no-stack', {error:{message:'another methods'}});

        });

        it ('named logger', () => {
            process.env.CORE_CHAINCODE_LOGGING_LEVEL = 'DEBUG';

            const log = Logger.getLogger('fred');
            log.debug('hello', 'fred');

        });
    });
});