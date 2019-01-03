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
const runSequence = require('run-sequence');

const childProcess = require('child_process');
const exec = childProcess.exec;
const execFile = util.promisify(childProcess.execFile);

gulp.task('test-devmode', ['invokeAllFnsInDev']);

gulp.task('invokeAllFnsInDev', (done) => {

    const tasks = [

        // ensure that the fabric shim in it's entirity is copied over and verdaccioed
        'st-copy-shim-crypto',

        // ensure that the fabric is setup and the chaincode has been constructed
        'st-copy-chaincode',

        // Use the CLI to start up the chaincode
        'dm-startup-chaincode',

        // install
        'st-install_chaincode',

        // instantiate
        'st-instantiate_chaincode',
        'delay',

        // check it didn't start up a docker image but used devmode
        'check-docker',

        // invoke all functions
        'invoke_functions',

        // kill the dev mode cc
        'kill-cli'

    ];

    console.log('=== Starting Dev Mode Tests');
    runSequence(...tasks, done);

});

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

gulp.task('dm-startup-chaincode', async (done) => {
    const script = util.format('docker exec cli bash -c "cd %s; npm install; node_modules/.bin/fabric-chaincode-node start --peer.address peer0.org1.example.com:7052 --chaincode-id-name %s --module-path %s"',
    // the /etc/hyperledger/config has been mapped to the
    // basic-network folder in the test setup for the CLI docker
        '/etc/hyperledger/config/scenario/src/mysmartcontract.v0',
        'mysmartcontract:v0',
        '/etc/hyperledger/config/scenario/src/mysmartcontract.v0');

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

gulp.task('kill-cli', () => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([
            'docker kill cli'
        ], {
            verbose: true, // so we can see the docker command output
            ignoreErrors: true // kill and rm may fail because the containers may have been cleaned up
        }));
});
