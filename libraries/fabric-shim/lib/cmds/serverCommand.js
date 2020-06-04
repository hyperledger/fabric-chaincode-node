/*
# Copyright Hitachi America, Ltd. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

exports.command = 'server [options]';
exports.desc = 'Start the chaincode as a server';

const validOptions = {
    'chaincode-address': {type: 'string', required: true},
    'grpc.max_send_message_length': {type: 'number', default: -1},
    'grpc.max_receive_message_length': {type: 'number', default: -1},
    'grpc.keepalive_time_ms': {type: 'number', default: 110000},
    'grpc.http2.min_time_between_pings_ms': {type: 'number', default: 110000},
    'grpc.keepalive_timeout_ms': {type: 'number', default: 20000},
    'grpc.http2.max_pings_without_data': {type: 'number', default: 0},
    'grpc.keepalive_permit_without_calls': {type: 'number', default: 1},
    'chaincode-id': {type: 'string', required: true},
    'module-path': {type: 'string', default: process.cwd()}
};

exports.validOptions = validOptions;

exports.builder = function (yargs) {
    yargs.options(validOptions);

    yargs.usage('fabric-chaincode-node server --chaincode-address 0.0.0.0:9999 --chaincode-id mycc_v0:abcdef12345678...');

    return yargs;
};

exports.handler = function (argv) {
    const Bootstrap = require('../contract-spi/bootstrap');

    return argv.thePromise = Bootstrap.bootstrap(true);
};

exports.getArgs = function (yargs) {
    const argv = {};

    for (const name in validOptions) {
        argv[name] = yargs.argv[name];
    }

    // Translate the options to server options
    argv.ccid = argv['chaincode-id'];
    argv.address = argv['chaincode-address'];

    delete argv['chaincode-id'];
    delete argv['chaincode-address'];

    return argv;
};
