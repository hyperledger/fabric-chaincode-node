/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const {series} = require('gulp');

const {shell: runcmds} = require('../shell/cmd');
const util = require('util');
const fs = require('fs-extra');
const path = require('path');


const {_delay, getTLSArgs} = require('./utils');

const Ajv = require('ajv');

// const execFile = util.promisify(require('child_process').execFile);
const CHANNEL_NAME = 'mychannel';

/* eslint-disable no-console */

const invokeFns = async () => {
    await runcmds([
        util.format('docker exec org1_cli peer chaincode invoke %s -C %s -n %s -c %s --waitForEvent',
            getTLSArgs(),
            CHANNEL_NAME,
            'mysmartcontract',
            '\'{"Args":["setNewAssetValue","\'42\'"]}\'')
    ]);

};

const queryFns = async () => {

    const result = await runcmds([
        util.format('docker exec org2_cli peer chaincode query %s -C %s -n %s -c %s',
            getTLSArgs(),
            CHANNEL_NAME,
            'mysmartcontract',
            '\'{"Args":["org.hyperledger.fabric:GetMetadata"]}\'')
    ]);
    console.log(result[0]);
    console.log(result);
    const metadata = JSON.parse(result[0]);
    const expectedMetadata = '{"$schema":"https://fabric-shim.github.io/release-1.4/contract-schema.json","contracts":{"UpdateValues":{"name":"UpdateValues","contractInstance":{"name":"UpdateValues","logBuffer":{"output":[]},"default":true},"transactions":[{"name":"setup","tags":["submitTx"]},{"name":"setNewAssetValue","tags":["submitTx"]},{"name":"doubleAssetValue","tags":["submitTx"]}],"info":{"title":"","version":""}},"RemoveValues":{"name":"RemoveValues","contractInstance":{"name":"RemoveValues"},"transactions":[{"name":"quarterAssetValue","tags":["submitTx"]},{"name":"getAssetValue","tags":["submitTx"]}],"info":{"title":"","version":""}},"org.hyperledger.fabric":{"name":"org.hyperledger.fabric","contractInstance":{"name":"org.hyperledger.fabric"},"transactions":[{"name":"GetMetadata"}],"info":{"title":"","version":""}}},"info":{"version":"1.0.0","title":"chaincode"},"components":{"schemas":{}}}';

    const schema = fs.readFileSync(path.join(__dirname, '../../fabric-contract-api/schema/contract-schema.json'));

    const ajv = new Ajv({schemaId: 'id'});
    ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));

    if (!ajv.validate(JSON.parse(schema), metadata)) {
        throw new Error('Expected generated metadata to match the schema');
    }

    if (JSON.stringify(metadata) !== expectedMetadata) {
        throw new Error(`Expected query response to equal ${expectedMetadata} \ninstead recieved: \n${JSON.stringify(metadata)}`);
    }

};

const instantiateChaincode = async () => {
    await runcmds([
        util.format('docker exec org1_cli peer chaincode instantiate -o %s %s -l node -C %s -n %s -v v0 -c %s -P %s',
            'orderer.example.com:7050',
            getTLSArgs(),
            CHANNEL_NAME,
            'mysmartcontract',
            '\'{"Args":["UpdateValues:setup"]}\'',
            '\'OR ("Org1MSP.member")\'')
    ]);
};

// make sure `gulp channel-init` is run first
const installChaincode = async () => {
    const peerInstall = util.format(
        'peer chaincode install -l node -n %s -v v0 -p %s',
        'mysmartcontract',
        // the test folder containing scenario is mapped to /opt/gopath/src/github.com/chaincode
        '/opt/gopath/src/github.com/chaincode/scenario'
    );
    await runcmds([

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
    ]);
};

/**
 * Invoke all the smart contract functions
 */

const invokeAllFns = series(
    installChaincode,
    instantiateChaincode,
    _delay,
    // invoke all functions
    invokeFns,
    // query the functions
    queryFns
);

exports.testScenario = invokeAllFns;

