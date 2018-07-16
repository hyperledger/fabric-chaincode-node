/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const winston = require('winston');
const chai = require('chai');
const expect = chai.expect;

const rewire = require('rewire');
const Logger = rewire('../../src/lib/logger.js');

describe('Logger', () => {
	describe('getLogger', () => {
		it ('should create a new logger name unknown', () => {
			let log = Logger.getLogger('unknown name');

			expect(log instanceof winston.Logger).to.be.ok;
			expect(log.level).to.deep.equal('info');
		});

		it ('should return existing logger if known name used', () => {
			let myLogger = {
				hello: 'world'
			};

			Logger.__set__('loggers', {
				'myLogger': myLogger
			});

			let log = Logger.getLogger('myLogger');
			expect(log).to.deep.equal(Object.assign(myLogger, {log: 'info'}));

			Logger.__set__('loggers', {});
		});

		it ('should set the log level to fatal when env var set to CRITICAL', () => {
			process.env['CORE_CHAINCODE_LOGGING_SHIM'] = 'CRITICAL';

			let log = Logger.getLogger();

			expect(log instanceof winston.Logger).to.be.ok;
			expect(log.level).to.deep.equal('fatal');
		});

		it ('should set the log level to error when env var set to ERROR', () => {
			process.env['CORE_CHAINCODE_LOGGING_SHIM'] = 'ERROR';

			let log = Logger.getLogger();

			expect(log instanceof winston.Logger).to.be.ok;
			expect(log.level).to.deep.equal('error');
		});

		it ('should set the log level to warn when env var set to WARNING', () => {
			process.env['CORE_CHAINCODE_LOGGING_SHIM'] = 'WARNING';

			let log = Logger.getLogger();

			expect(log instanceof winston.Logger).to.be.ok;
			expect(log.level).to.deep.equal('warn');
		});

		it ('should set the log level to debug when env var set to DEBUG', () => {
			process.env['CORE_CHAINCODE_LOGGING_SHIM'] = 'DEBUG';

			let log = Logger.getLogger();

			expect(log instanceof winston.Logger).to.be.ok;
			expect(log.level).to.deep.equal('debug');
		});
	});
});

// test('chaincode logger setup tests', (t) => {
// 	process.env.CORE_CHAINCODE_LOGGING_SHIM = 'critical';
// 	let log = Logger.getLogger();
// 	t.equal(log.level, 'fatal', 'Test log level is correctly set for critical');

// 	process.env.CORE_CHAINCODE_LOGGING_SHIM = 'WARNING';
// 	log = Logger.getLogger();
// 	t.equal(log.level, 'warn', 'Test log level is correctly set for warning');
// 	process.env.CORE_CHAINCODE_LOGGING_SHIM = 'Debug';
// 	log = Logger.getLogger();
// 	t.equal(log.level, 'debug', 'Test log level is correctly set for debug');
// 	process.env.CORE_CHAINCODE_LOGGING_SHIM = 'ERRor';
// 	log = Logger.getLogger();
// 	t.equal(log.level, 'error', 'Test log level is correctly set for error');

// 	delete process.env.CORE_CHAINCODE_LOGGING_SHIM;

// 	log = Logger.getLogger();
// 	t.equal(log.level, 'info', 'Test log level is correctly set for error');

// 	t.end();
// });