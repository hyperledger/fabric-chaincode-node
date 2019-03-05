/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const gulp = require('gulp');
const shell = require('gulp-shell');

const util = require('util');
const fs = require('fs-extra');
const path = require('path');

const getTLSArgs = require('./utils').getTLSArgs;

const Ajv = require('ajv');

const execFile = util.promisify(require('child_process').execFile);
const CHANNEL_NAME = 'mychannel';

require('./setup'); // ensure cleanup task defined

/* eslint-disable no-console */

gulp.task('invoke_functions', async (done) => {

    const options = {};
    const script = 'docker';
    const args = util.format('exec org1_cli peer chaincode invoke %s -C %s -n %s -c %s --waitForEvent',
        getTLSArgs(),
        CHANNEL_NAME,
        'mysmartcontract',
        '{"Args":["setNewAssetValue","\'42\'"]}').split(' ');  //eslint-disable-line
        // use the short form with the default being the first contract in the export list

    const {error, stdout, stderr} = await execFile(script, args, options);
    if (error) {
        done(error);
    } else {
        // validate the stdout/stderr
        console.log(stdout);
        console.log(stderr);

        // if the output needs to be parsed use this format
        // let data = JSON.parse(regexp.exec(stderr)[1].replace(/\\/g,''));
    }
});

gulp.task('query_functions', async (done) => {

    const options = {};
    const script = 'docker';
    const args = util.format('exec org2_cli peer chaincode query %s -C %s -n %s -c %s',
        getTLSArgs(),
        CHANNEL_NAME,
        'mysmartcontract',
        '{"Args":["org.hyperledger.fabric:GetMetadata"]}').split(' ');

    const {error, stdout, stderr} = await execFile(script, args, options);
    if (error) {
        done(error);
    } else {
        // validate the stdout/stderr
        console.log(stdout);
        console.log(stderr);

        const metadata = JSON.parse(stdout);

        const expectedMetadata = '{"$schema":"https://fabric-shim.github.io/master/contract-schema.json","contracts":{"UpdateValues":{"name":"UpdateValues","contractInstance":{"name":"UpdateValues","logBuffer":{"output":[]},"default":true},"transactions":[{"name":"setup","tags":["submitTx"]},{"name":"setNewAssetValue","tags":["submitTx"]},{"name":"doubleAssetValue","tags":["submitTx"]}],"info":{"title":"","version":""}},"RemoveValues":{"name":"RemoveValues","contractInstance":{"name":"RemoveValues"},"transactions":[{"name":"quarterAssetValue","tags":["submitTx"]},{"name":"getAssetValue","tags":["submitTx"]}],"info":{"title":"","version":""}},"org.hyperledger.fabric":{"name":"org.hyperledger.fabric","contractInstance":{"name":"org.hyperledger.fabric"},"transactions":[{"name":"GetMetadata"}],"info":{"title":"","version":""}}},"info":{"version":"1.0.0","title":"chaincode"},"components":{"schemas":{}}}';

        const schema = fs.readFileSync(path.join(__dirname, '../../fabric-contract-api/schema/contract-schema.json'));

        const ajv = new Ajv({schemaId: 'id'});
        ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));

        if (!ajv.validate(JSON.parse(schema), metadata)) {
            throw new Error('Expected generated metadata to match the schema');
        }

        if (JSON.stringify(metadata) !== expectedMetadata) {
            throw new Error(`Expected query response to equal ${expectedMetadata} \ninstead recieved: \n${JSON.stringify(metadata)}`);
        }
    }
});

gulp.task('st-instantiate_chaincode', () => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([
            util.format('docker exec org1_cli peer chaincode instantiate -o %s %s -l node -C %s -n %s -v v0 -c %s -P %s',
                'orderer.example.com:7050',
                getTLSArgs(),
                CHANNEL_NAME,
                'mysmartcontract',
                '\'{"Args":["UpdateValues:setup"]}\'',
                '\'OR ("Org1MSP.member")\'')
        ]));
});

// make sure `gulp channel-init` is run first
gulp.task('st-install_chaincode', () => {
    const peerInstall = util.format(
        'peer chaincode install -l node -n %s -v v0 -p %s',
        'mysmartcontract',
        // the test folder containing scenario is mapped to /opt/gopath/src/github.com/chaincode
        '/opt/gopath/src/github.com/chaincode/scenario'
    );

    return gulp.src('*.js', {read: false})
        .pipe(shell([
            util.format(
                'docker exec %s %s',
                'org1_cli',
                peerInstall
            ),
            util.format(
                'docker exec %s %s',
                'org2_cli',
                peerInstall
            ),
        ]));
});

/**
 * Invoke all the smart contract functions
 */

gulp.task('invokeAllFns', gulp.series(
    [
        // install
        'st-install_chaincode',

        // instantiate
        'st-instantiate_chaincode',
        'delay',
        // invoke all functions
        'invoke_functions',

        // query the functions
        'query_functions',

        'clean-up-chaincode'
    ]
));

gulp.task('test-scenario', gulp.series('invokeAllFns'));
