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
const execFile = util.promisify(childProcess.execFile);

const peerAddress = require('../../test/constants').peerAddress;

require('./scenario');

gulp.task('check-docker', async (done) => {
    const options = {};
    const script = 'docker';
    const args = ['ps', '-a'];

    const {error, stdout, stderr} = await execFile(script, args, options);
    if (error) {
        done(error);
    } else {
        // validate the stdout/stderr
        console.log(stdout); // eslint-disable-line
        console.log(stderr); // eslint-disable-line

        if (stdout.includes('dev-peer0.org1.example.com-mysmartcontract-v0-')) {
            done(new Error('Peer created docker on instantiate rather than use running dev contract'));
        }
    }
});

gulp.task('cli-install-chaincode', gulp.series(() => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([
            // test folder mapped to /opt/gopath/src/github.com/chaincode
            util.format(
                'docker exec org1_cli bash -c "apk add nodejs nodejs-npm python make g++; cd %s; npm install"',
                '/opt/gopath/src/github.com/chaincode/scenario',
            )
        ]));
}));

gulp.task('dm-startup-chaincode', async (done) => {
    const script = util.format('docker exec org1_cli bash -c "node %s/node_modules/fabric-shim/cli.js start --peer.address %s --chaincode-id-name %s --module-path %s"',
        '/opt/gopath/src/github.com/chaincode/scenario',
        peerAddress,
        'mysmartcontract:v0',
        '/opt/gopath/src/github.com/chaincode/scenario');

    try {
        await new Promise((resolve, reject) => {
            const child = exec(script);
            let successful = false;

            child.stderr.on('data', (data) => {
                if (Buffer.isBuffer(data)) {
                    data = data.toString();
                }

                console.log('dm-startup-chaincode', 'stderr', data);
            });

            child.stdout.on('data', (data) => {
                if (Buffer.isBuffer(data)) {
                    data = data.toString();
                }

                if (data.includes('Successfully established communication with peer node')) {
                    successful = true;
                    resolve(child);
                }

                console.log('dm-startup-chaincode', 'stdout', data);
            });

            child.on('close', (code, signal) => {
                console.log('dm-startup-chaincode', 'close', code, signal);
                if (!successful) {
                    reject(new Error(`Starting up chaincode via CLI failed, code = ${code}, signal = ${signal}`));
                }
            });
        });
    } catch (err) {
        done(err);
    }
});

gulp.task('dm-clean-up-chaincode', () => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([
            'docker exec org1_cli find test -name "node_modules" -depth -exec rm -r {} \\;',
            'docker exec org1_cli find test -name "package-lock.json" -depth -exec rm -r {} \\;',
        ], {
            verbose: true, // so we can see the docker command output
            ignoreErrors: true // kill and rm may fail because the containers may have been cleaned up
        }));
});

gulp.task('stop-cli-running-chaincode', () => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([
            'docker exec org1_cli /etc/hyperledger/fixtures/kill-chaincode-node.sh'
        ], {
            verbose: true, // so we can see the docker command output
            ignoreErrors: true // kill and rm may fail because the containers may have been cleaned up
        }));
});

/**
 * Invoke all the smart contract functions - steals some commands from scenario as uses same contract
 */

gulp.task('invokeAllFnsDevMode', gulp.series(
    [
        'cli-install-chaincode',

        // Start chaincode
        'dm-startup-chaincode',

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

gulp.task('test-scenario-devmode', gulp.series('invokeAllFnsDevMode'));