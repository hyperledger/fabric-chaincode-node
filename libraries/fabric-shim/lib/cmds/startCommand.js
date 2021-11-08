/*
 * Copyright contributors to Hyperledger Fabric.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const YargsParser = require('yargs-parser');

const validOptions = {
    'peer.address': {type: 'string', required: true},
    'grpc.max_send_message_length': {type: 'number', default: -1},
    'grpc.max_receive_message_length': {type: 'number', default: -1},
    'grpc.keepalive_time_ms': {type: 'number', default: 110000},
    'grpc.http2.min_time_between_pings_ms': {type: 'number', default: 110000},
    'grpc.keepalive_timeout_ms': {type: 'number', default: 20000},
    'grpc.http2.max_pings_without_data': {type: 'number', default: 0},
    'grpc.keepalive_permit_without_calls': {type: 'number', default: 1},
    'ssl-target-name-override': {type: 'string'},
    'chaincode-id-name': {type: 'string', required: true},
    'module-path': {type: 'string', default: process.cwd()}
};

module.exports.validOptions = validOptions;

exports.command = 'start [options]';
exports.desc = 'Start an empty chaincode';
exports.builder = (yargs) => {
    yargs.options(validOptions);

    yargs.usage('fabric-chaincode-node start --peer.address localhost:7051 --chaincode-id-name mycc');

    return yargs;
};
exports.handler = async function (argv) {
    const Bootstrap = require('../contract-spi/bootstrap');
    await Bootstrap.bootstrap();
};

exports.getArgs = function (yargs) {
    let argv = yargs.argv;

    if (argv.$0 !== 'fabric-chaincode-node') {

        const defaults = {};

        const required = [];

        for (const key in validOptions) {
            if (validOptions[key].hasOwnProperty('default')) {   // eslint-disable-line no-prototype-builtins
                defaults[key] = validOptions[key].default;
            }

            if (validOptions[key].hasOwnProperty('required') && validOptions[key].required) {  // eslint-disable-line no-prototype-builtins
                required.push(key);
            }
        }

        argv = YargsParser(process.argv.slice(2), {
            default: defaults,
            configuration: {
                'dot-notation': false
            },
            envPrefix: 'CORE'
        });

        argv['chaincode-id-name'] = argv.chaincodeIdName;
        argv['module-path'] = argv.modulePath;

        // eslint-disable-next-line eqeqeq
        if (argv.CORE_PEER_ADDRESS != null) {
            argv['peer.address'] = argv.CORE_PEER_ADDRESS;
        }

        required.forEach((argName) => {
            if (!argv.hasOwnProperty(argName) || typeof(argv[argName]) === 'undefined') {  // eslint-disable-line no-prototype-builtins
                throw new Error('Missing required argument ' + argName);
            }
        });
    }

    return argv;
};
