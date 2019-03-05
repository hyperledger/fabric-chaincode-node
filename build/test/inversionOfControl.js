/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

// remove once inversion of control in fabric as other tests will cover this

/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';
/* eslint-disable no-console */

const gulp = require('gulp');

const util = require('util');

const childProcess = require('child_process');
const exec = childProcess.exec;

const peerAddress = require('../../test/constants').peerAddress;

require('./scenario');

gulp.task('inv-startup-chaincode', async (done) => {
    const script = util.format('docker exec org1_cli bash -c "cd %s; npm start -- --peer.address %s --chaincode-id-name %s --module-path %s"',
    // the /etc/hyperledger/config has been mapped to the
    // basic-network folder in the test setup for the CLI docker
        '/opt/gopath/src/github.com/chaincode/scenario/node_modules/fabric-shim',
        peerAddress,
        'mysmartcontract:v0',
        '/opt/gopath/src/github.com/chaincode/scenario');

    try {
        await new Promise((resolve, reject) => {
            const child = exec(script);

            child.stdout.on('data', (data) => {
                if (Buffer.isBuffer(data)) {
                    data = data.toString();
                }

                if (data.includes('Successfully established communication with peer node')) {
                    resolve(child);
                }
            });

            child.stderr.on('data', (data) => {
                console.log('[STR] stderr "%s"', String(data));
            });

            child.on('close', (code, signal) => {
                reject('Starting up chaincode via CLI failed');
            });
        });
    } catch (err) {
        done(err);
    }
});

/**
 * Invoke all the smart contract functions - steals some commands from scenario as uses same contract
 */

gulp.task('invokeAllFnsInvCtrl', gulp.series(
    [
        'cli-install-chaincode',

        // Start chaincode
        'inv-startup-chaincode',

        // install
        'st-install_chaincode',

        // instantiate
        'st-instantiate_chaincode',
        'delay',

        // Check it didnt make docker images
        'check-docker',

        // invoke all functions
        'invoke_functions',

        // query the functions
        'query_functions',

        // stop chaincode
        'stop-cli-running-chaincode',

        'dm-clean-up-chaincode'
    ]
));

gulp.task('test-scenario-invctrl', gulp.series('invokeAllFnsInvCtrl'));
