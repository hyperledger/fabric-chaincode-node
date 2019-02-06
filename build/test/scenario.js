/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const gulp = require('gulp');
const shell = require('gulp-shell');
const using = require('gulp-using');
const filter = require('gulp-filter');
const jsonTransform = require('gulp-json-transform');

const util = require('util');
const fs = require('fs-extra');
const path = require('path');
const log = require('fancy-log');
const test = require('../../test/constants.js');

const os = require('os');
const Ajv = require('ajv');

const execFile = util.promisify(require('child_process').execFile);
const CHANNEL_NAME = 'mychannel';
const tls = process.env.TLS ? process.env.TLS : 'false';
const delay = require('delay');

/* eslint-disable no-console */

gulp.task('delay', () => {
    log('waiting for 3seconds...');
    return delay(3000);
});

function getTLSArgs() {
    let args = '';
    if (tls === 'true') {
        args = util.format('--tls %s --cafile %s', tls,
            '/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem');
    }
    return args;
}

gulp.task('invoke_functions', async (done) => {

    const options = {};
    const script = 'docker';
    const args = util.format('exec cli peer chaincode invoke %s -C %s -n %s -c %s --waitForEvent',
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
    const args = util.format('exec cli peer chaincode query %s -C %s -n %s -c %s',
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

        const expectedMetadata =
        '{"$schema":"https://fabric-shim.github.io/master/contract-schema.json","contracts":{"UpdateValues":{"name":"UpdateValues","contractInstance":{"name":"UpdateValues","logBuffer":{"output":[]},"default":true},"transactions":[{"name":"unknownTransaction","tags":["submitTx"]},{"name":"beforeTransaction","tags":["submitTx"]},{"name":"createContext","tags":["submitTx"]},{"name":"setup","tags":["submitTx"]},{"name":"setNewAssetValue","tags":["submitTx"]},{"name":"doubleAssetValue","tags":["submitTx"]}],"info":{"title":"","version":""}},"RemoveValues":{"name":"RemoveValues","contractInstance":{"name":"RemoveValues"},"transactions":[{"name":"quarterAssetValue","tags":["submitTx"]},{"name":"getAssetValue","tags":["submitTx"]}],"info":{"title":"","version":""}},"org.hyperledger.fabric":{"name":"org.hyperledger.fabric","contractInstance":{"name":"org.hyperledger.fabric"},"transactions":[{"name":"GetMetadata"}],"info":{"title":"","version":""}}},"info":{"version":"1.0.0","title":"chaincode"},"components":{"schemas":{}}}';

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

gulp.task('st-copy-shim', gulp.series('protos', () => {
    // first ensure the chaincode folder has the latest shim code
    const srcPath = path.join(__dirname, '../../fabric-shim/**');
    const destPath = path.join(test.BasicNetworkTestDir, 'scenario/src/fabric-shim');
    fs.ensureDirSync(destPath);

    const f = filter(['**/package.json'], {restore: true});

    return gulp.src(srcPath)
        .pipe(f)
        .pipe(using())
        .pipe(jsonTransform((data, file) => {
            data.version = data.version + '-test';
            return data;
        }))
        .pipe(f.restore)
        .pipe(gulp.dest(destPath));
}));

gulp.task('st-copy-api', gulp.series('st-copy-shim', () => {
    // first ensure the chaincode folder has the latest shim code
    const srcPath = path.join(__dirname, '../../fabric-contract-api/**');
    const destPath = path.join(test.BasicNetworkTestDir, 'scenario/src/fabric-contract-api');
    fs.ensureDirSync(destPath);

    const f = filter(['**/package.json'], {restore: true});

    return gulp.src(srcPath)
        .pipe(f)
        .pipe(using())
        .pipe(jsonTransform((data, file) => {
            data.version = data.version + '-test';
            return data;
        }))
        .pipe(f.restore)
        .pipe(gulp.dest(destPath));
}));

gulp.task('st-copy-shim-crypto', gulp.series('st-copy-api', () => {
    // first ensure the chaincode folder has the latest shim code
    const srcPath = path.join(__dirname, '../../fabric-shim-crypto/**');
    const destPath = path.join(test.BasicNetworkTestDir, 'scenario/src/fabric-shim-crypto');
    fs.ensureDirSync(destPath);

    const f = filter(['**/package.json'], {restore: true});

    return gulp.src(srcPath)
        .pipe(f)
        .pipe(using())
        .pipe(jsonTransform((data, file) => {
            data.version = data.version + '-test';
            return data;
        }))
        .pipe(f.restore)
        .pipe(gulp.dest(destPath));
}));

gulp.task('localpublish', () => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([util.format('%s/local-npm.sh %s', __dirname, os.tmpdir())]));
});

gulp.task('st-copy-chaincode', gulp.series('localpublish', () => {

    // copy the test.js to chaincode folder
    const srcPath = path.join(__dirname, '../../test/scenario/*');
    const moduleArchivePath = path.join(test.BasicNetworkTestDir, 'scenario/src/*.tgz');
    const destPath = path.join(test.BasicNetworkTestDir, 'scenario/src/mysmartcontract.v0');
    return gulp.src([srcPath, moduleArchivePath])
        .pipe(gulp.dest(destPath));
}));

// make sure `gulp channel-init` is run first
gulp.task('st-install_chaincode', () => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([
            util.format('docker exec cli peer chaincode install -l node -n %s -v v0 -p %s',
                'mysmartcontract',
                // the /etc/hyperledger/config has been mapped to the
                // basic-network folder in the test setup for the CLI docker
                '/etc/hyperledger/config/scenario/src/mysmartcontract.v0')

        ]));
});

gulp.task('st-instantiate_chaincode', () => {
    return gulp.src('*.js', {read: false})
        .pipe(shell([
            util.format('docker exec cli peer chaincode instantiate -o %s %s -l node -C %s -n %s -v v0 -c %s -P %s',
                'orderer.example.com:7050',
                getTLSArgs(),
                CHANNEL_NAME,
                'mysmartcontract',
                '\'{"Args":["UpdateValues:setup"]}\'',
                '\'OR ("Org1MSP.member")\'')
        ]));
});

/**
 * Invoke all the smart contract functions
 */

gulp.task('invokeAllFns', gulp.series(
    [
        // ensure that the fabric shim in it's entirity is copied over and verdaccioed
        'st-copy-shim-crypto',

        // ensure that the fabric is setup and the chaincode has been constructed
        'st-copy-chaincode',

        // install
        'st-install_chaincode',

        // instantiate
        'st-instantiate_chaincode',
        'delay',
        // invoke all functions
        'invoke_functions',

        // query the functions
        'query_functions'
    ]
));

gulp.task('test-scenario', gulp.series('invokeAllFns'));
