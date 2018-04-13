/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const test = require('../base.js');
const Logger = require('fabric-shim/lib/logger.js');

test('chaincode logger setup tests', (t) => {
	process.env.CORE_CHAINCODE_LOGGING_SHIM = 'critical';
	let log = Logger.getLogger();
	t.equal(log.level, 'fatal', 'Test log level is correctly set for critical');

	process.env.CORE_CHAINCODE_LOGGING_SHIM = 'WARNING';
	log = Logger.getLogger();
	t.equal(log.level, 'warn', 'Test log level is correctly set for warning');
	process.env.CORE_CHAINCODE_LOGGING_SHIM = 'Debug';
	log = Logger.getLogger();
	t.equal(log.level, 'debug', 'Test log level is correctly set for debug');
	process.env.CORE_CHAINCODE_LOGGING_SHIM = 'ERRor';
	log = Logger.getLogger();
	t.equal(log.level, 'error', 'Test log level is correctly set for error');

	delete process.env.CORE_CHAINCODE_LOGGING_SHIM;

	log = Logger.getLogger();
	t.equal(log.level, 'info', 'Test log level is correctly set for error');

	t.end();
});