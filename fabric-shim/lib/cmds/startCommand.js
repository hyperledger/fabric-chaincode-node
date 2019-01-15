/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
exports.handler = function (argv) {
    const Bootstrap = require('../contract-spi/bootstrap');
    return argv.thePromise = Bootstrap.bootstrap();
};

exports.getArgs = function (yargs) {
    let argv = yargs.argv;

    if (argv.$0 !== 'fabric-chaincode-node') {

        const defaults = {};

        const required = [];

        for (const key in validOptions) {
            if (validOptions[key].hasOwnProperty('default')) {
                defaults[key] = validOptions[key].default;
            }

            if (validOptions[key].hasOwnProperty('required') && validOptions[key].required) {
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

        required.forEach((argName) => {
            if (!argv.hasOwnProperty(argName)) {
                throw new Error('Missing required argument ' + argName);
            }
        });
    }

    return argv;
};
