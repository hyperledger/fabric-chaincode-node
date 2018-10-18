/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
/* global describe it */
'use strict';

const winston = require('winston');
const chai = require('chai');
const expect = chai.expect;

const rewire = require('rewire');
const Logger = rewire('../../../fabric-shim/lib/logger.js');

describe('Logger', () => {
    describe('getLogger', () => {
        it ('should create a new logger name unknown', () => {
            const log = Logger.getLogger('unknown name');

            expect(log instanceof winston.Logger).to.be.ok;
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
            process.env.CORE_CHAINCODE_LOGGING_SHIM = 'CRITICAL';

            const log = Logger.getLogger();

            expect(log instanceof winston.Logger).to.be.ok;
            expect(log.level).to.deep.equal('fatal');
        });

        it ('should set the log level to error when env var set to ERROR', () => {
            process.env.CORE_CHAINCODE_LOGGING_SHIM = 'ERROR';

            const log = Logger.getLogger();

            expect(log instanceof winston.Logger).to.be.ok;
            expect(log.level).to.deep.equal('error');
        });

        it ('should set the log level to warn when env var set to WARNING', () => {
            process.env.CORE_CHAINCODE_LOGGING_SHIM = 'WARNING';

            const log = Logger.getLogger();

            expect(log instanceof winston.Logger).to.be.ok;
            expect(log.level).to.deep.equal('warn');
        });

        it ('should set the log level to debug when env var set to DEBUG', () => {
            process.env.CORE_CHAINCODE_LOGGING_SHIM = 'DEBUG';

            const log = Logger.getLogger();

            expect(log instanceof winston.Logger).to.be.ok;
            expect(log.level).to.deep.equal('debug');
        });
    });

    describe('formatter', () => {
        it ('', () => {
            process.env.CORE_CHAINCODE_LOGGING_SHIM = 'DEBUG';

            const log = Logger.getLogger();
            log.debug();
            log.debug('hello');
            log.debug('hello', {'one':'two'});
            // sinon.assert.calledWith(logSpy,'wibble');
        });

        it ('', () => {
            process.env.CORE_CHAINCODE_LOGGING_SHIM = 'DEBUG';

            const log = Logger.getLogger('fred');
            log.debug('hello', 'fred');
            // sinon.assert.calledWith(logSpy,'wibble');
        });
    });
});
