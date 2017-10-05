/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const log4js = require('log4js');

module.exports.getLogger = function(name) {
	let logger = log4js.getLogger(name);

	// set the logging level based on the environment variable
	// configured by the peer
	let level = process.env['CORE_CHAINCODE_LOGGING_SHIM'];
	let loglevel = 'info';
	if (typeof level === 'string') {
		switch (level.toUpperCase()) {
		case 'CRITICAL':
			loglevel = 'fatal';
			break;
		case 'ERROR':
			loglevel = 'error';
			break;
		case 'WARNING':
			loglevel = 'warn';
			break;
		case 'DEBUG':
			loglevel = 'debug';
		}
	}

	logger.level = loglevel;
	return logger;
};
