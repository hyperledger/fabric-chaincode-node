/*
# Copyright Hitachi America, Ltd. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const fs = require('fs');

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
    'chaincode-tls-cert-file': {type: 'string', conflicts: 'chaincode-tls-cert-path'},
    'chaincode-tls-cert-path': {type: 'string', conflicts: 'chaincode-tls-cert-file'},
    'chaincode-tls-key-file': {type: 'string', conflicts: 'chaincode-tls-key-path'},
    'chaincode-tls-key-path': {type: 'string', conflicts: 'chaincode-tls-key-file'},
    'chaincode-tls-client-cacert-file': {type: 'string', conflicts: 'chaincode-tls-client-cacert-path'},
    'chaincode-tls-client-cacert-path': {type: 'string', conflicts: 'chaincode-tls-client-cacert-file'},
    'module-path': {type: 'string', default: process.cwd()}
};

exports.validOptions = validOptions;

exports.builder = function (yargs) {
    yargs.options(validOptions);

    yargs.usage('fabric-chaincode-node server --chaincode-address 0.0.0.0:9999 --chaincode-id mycc_v0:abcdef12345678...');

    yargs.check((argv) => {
        if (argv['chaincode-tls-key-file'] || argv['chaincode-tls-key-path'] ||
            argv['chaincode-tls-cert-file'] || argv['chaincode-tls-cert-path']) {
            // TLS should be enabled
            if (!argv['chaincode-tls-key-file'] && !argv['chaincode-tls-key-path']) {
                throw new Error('A TLS option is set but no key is specified');
            }
            if (!argv['chaincode-tls-cert-file'] && !argv['chaincode-tls-cert-path']) {
                throw new Error('A TLS option is set but no cert is specified');
            }
        }
        return true;
    });

    return yargs;
};

exports.handler = async function (argv) {
    const Bootstrap = require('../contract-spi/bootstrap');

    await Bootstrap.bootstrap(true);
};

exports.getArgs = function (yargs) {
    const argv = {};

    for (const name in validOptions) {
        argv[name] = yargs.argv[name];
    }

    // Load the cryptographic files if TLS is enabled
    if (argv['chaincode-tls-key-file'] || argv['chaincode-tls-key-path'] ||
        argv['chaincode-tls-cert-file'] || argv['chaincode-tls-cert-path']) {

        const tlsProps = {};

        if (argv['chaincode-tls-key-file']) {
            tlsProps.key = fs.readFileSync(argv['chaincode-tls-key-file']);
        } else {
            tlsProps.key = Buffer.from(fs.readFileSync(argv['chaincode-tls-key-path']).toString(), 'base64');
        }

        if (argv['chaincode-tls-cert-file']) {
            tlsProps.cert = fs.readFileSync(argv['chaincode-tls-cert-file']);
        } else {
            tlsProps.cert = Buffer.from(fs.readFileSync(argv['chaincode-tls-cert-path']).toString(), 'base64');
        }

        // If cacert option is specified, enable client certificate validation
        if (argv['chaincode-tls-client-cacert-file']) {
            tlsProps.clientCACerts = fs.readFileSync(argv['chaincode-tls-client-cacert-file']);
        } else if (argv['chaincode-tls-client-cacert-path']) {
            tlsProps.clientCACerts =  Buffer.from(fs.readFileSync(argv['chaincode-tls-client-cacert-path']).toString(), 'base64');
        }

        argv.tlsProps = tlsProps;
    }

    // Translate the options to server options
    argv.ccid = argv['chaincode-id'];
    argv.address = argv['chaincode-address'];

    delete argv['chaincode-id'];
    delete argv['chaincode-address'];

    return argv;
};
