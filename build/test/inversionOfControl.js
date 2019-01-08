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
const shell = require('gulp-shell');

const util = require('util');

const childProcess = require('child_process');
const exec = childProcess.exec;

gulp.task('npm-install-chaincode', () => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([
            util.format('docker exec cli bash -c "cd %s; npm install"',
                '/etc/hyperledger/config/scenario/src/mysmartcontract.v0')

        ]));
});

gulp.task('inv-startup-chaincode', async (done) => {
    const script = util.format('docker exec cli bash -c "cd %s; npm install; npm rebuild; npm start -- --peer.address peer0.org1.example.com:7052 --chaincode-id-name %s --module-path %s"',
    // the /etc/hyperledger/config has been mapped to the
    // basic-network folder in the test setup for the CLI docker
        '/etc/hyperledger/config/scenario/src/fabric-shim',
        'mysmartcontract:v0',
        '/etc/hyperledger/config/scenario/src/mysmartcontract.v0');

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
