/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const {series} = require('gulp');
const delay = require('delay');

const util = require('util');
const fs = require('fs-extra');
const path = require('path');

const { shell: runcmds , getTLSArgs } = require('toolchain');
const Ajv = require('ajv');
const ip = require('ip');

const CHANNEL_NAME = 'mychannel';

/* eslint-disable no-console */

const invokeFunctions = async () => {

    const args = util.format('docker exec org1_cli peer chaincode invoke %s -C %s -n %s -c %s --waitForEvent',
        getTLSArgs(),
        CHANNEL_NAME,
        'mysmartcontract',
        '\'{"Args":["setNewAssetValue","\'42\'"]}\'');

    await runcmds([args]);
};

const queryFunctions = async () => {

    const args = util.format('docker exec org2_cli peer chaincode query %s -C %s -n %s -c %s',
        getTLSArgs(),
        CHANNEL_NAME,
        'mysmartcontract',
        '\'{"Args":["org.hyperledger.fabric:GetMetadata"]}\'');

    const stdoutList = await runcmds([args]);
    const stdout = stdoutList[0];
    // validate the stdout/stderr
    console.log(stdout);
    // console.log(stderr);

    const metadata = JSON.parse(stdout);

    const expectedMetadata = '{"$schema":"https://fabric-shim.github.io/master/contract-schema.json","contracts":{"UpdateValues":{"name":"UpdateValues","contractInstance":{"name":"UpdateValues","logBuffer":{"output":[]},"default":true},"transactions":[{"name":"setup","tags":["submitTx"]},{"name":"setNewAssetValue","tags":["submitTx"],"parameters":[{"name":"arg0","description":"Argument 0","schema":{"type":"string"}}]},{"name":"doubleAssetValue","tags":["submitTx"]}],"info":{"title":"","version":""}},"RemoveValues":{"name":"RemoveValues","contractInstance":{"name":"RemoveValues"},"transactions":[{"name":"quarterAssetValue","tags":["submitTx"]},{"name":"getAssetValue","tags":["submitTx"]}],"info":{"title":"","version":""}},"org.hyperledger.fabric":{"name":"org.hyperledger.fabric","contractInstance":{"name":"org.hyperledger.fabric"},"transactions":[{"name":"GetMetadata"}],"info":{"title":"","version":""}}},"info":{"version":"1.0.0","title":"chaincode"},"components":{"schemas":{}}}';

    const schema = fs.readFileSync(path.join(__dirname, '../../apis/fabric-contract-api/schema/contract-schema.json'));

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
    await delay(3000);
};

const installChaincode = async () => {
    const peerInstall = util.format(
        'peer chaincode install -l node -n %s -v v0 -p %s',
        'mysmartcontract',
        // the test folder containing scenario is mapped to /opt/gopath/src/github.com/chaincode
        '/opt/gopath/src/github.com/chaincode/scenario'
    );
    const npmrc = path.join(__dirname, '..', '..', 'test', 'chaincodes','scenario', '.npmrc');
    await runcmds([
        `echo "registry=http://${ip.address()}:4873" > ${npmrc}`,
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
        `rm -f ${npmrc}`
    ]);
};

exports.default = series(installChaincode, instantiateChaincode, invokeFunctions, queryFunctions);
