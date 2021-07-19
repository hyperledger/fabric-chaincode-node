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

const { shell: runcmds , getTLSArgs, getPeerAddresses } = require('toolchain');
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

    const expectedMetadata = '{"$schema":"https://hyperledger.github.io/fabric-chaincode-node/main/api/contract-schema.json","contracts":{"UpdateValues":{"name":"UpdateValues","contractInstance":{"name":"UpdateValues","logBuffer":{"output":[]},"default":true},"transactions":[{"name":"setup","tags":["SUBMIT","submitTx"]},{"name":"setNewAssetValue","tags":["SUBMIT","submitTx"],"parameters":[{"name":"arg0","description":"Argument 0","schema":{"type":"string"}}]},{"name":"doubleAssetValue","tags":["SUBMIT","submitTx"]}],"info":{"title":"","version":""}},"RemoveValues":{"name":"RemoveValues","contractInstance":{"name":"RemoveValues"},"transactions":[{"name":"quarterAssetValue","tags":["SUBMIT","submitTx"]},{"name":"getAssetValue","tags":["SUBMIT","submitTx"]}],"info":{"title":"","version":""}},"org.hyperledger.fabric":{"name":"org.hyperledger.fabric","contractInstance":{"name":"org.hyperledger.fabric"},"transactions":[{"name":"GetMetadata"}],"info":{"title":"","version":""}}},"info":{"version":"1.0.0","title":"chaincode"},"components":{"schemas":{}}}';

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
    const endorsementPolicy = '"OR (\'Org1MSP.member\', \'Org2MSP.member\')"';
    const queryInstalled = util.format(
        'peer lifecycle chaincode queryinstalled --output json'
    );
    const sequence = 1;

    const approveChaincode = util.format(
        'peer lifecycle chaincode approveformyorg -o %s %s -C %s -n %s -v %s --init-required --package-id %s --sequence %d --signature-policy %s',
        'orderer.example.com:7050',
        getTLSArgs(),
        CHANNEL_NAME,
        'mysmartcontract',
        'v0',
        '%s', // To be filled in for each org
        sequence,
        endorsementPolicy
    );

    const outputs = await runcmds([
        util.format(
            'docker exec %s %s',
            'org1_cli',
            queryInstalled
        ),
        util.format(
            'docker exec %s %s',
            'org2_cli',
            queryInstalled
        ),
    ]);

    const packageIdOrg1 = findPackageId(outputs[0], 'mysmartcontract_v0');
    const packageIdOrg2 = findPackageId(outputs[1], 'mysmartcontract_v0');

    // Approve the chaincode and commit
    await runcmds([
        util.format('docker exec %s %s',
            'org1_cli',
            util.format(approveChaincode, packageIdOrg1)
        ),
        util.format('docker exec %s %s',
            'org2_cli',
            util.format(approveChaincode, packageIdOrg2)
        ),
        util.format('docker exec org1_cli peer lifecycle chaincode commit -o %s %s -C %s -n %s -v %s --init-required --sequence %d --signature-policy %s %s',
            'orderer.example.com:7050',
            getTLSArgs(),
            CHANNEL_NAME,
            'mysmartcontract',
            'v0',
            sequence,
            endorsementPolicy,
            getPeerAddresses()
        )
    ]);
    await delay(3000);

    // Invoke init function
    await runcmds([
        util.format('docker exec org1_cli peer chaincode invoke %s -C %s -n %s -c %s --isInit --waitForEvent',
            getTLSArgs(),
            CHANNEL_NAME,
            'mysmartcontract',
            '\'{"Args":["UpdateValues:setup"]}\''
        )
    ]);
};

const findPackageId = (queryOutput, label) => {
    const output = JSON.parse(queryOutput);

    const cc = output.installed_chaincodes.filter((chaincode) => chaincode.label === label);
    if (cc.length !== 1) {
        throw new Error('Failed to find installed chaincode');
    }

    return cc[0].package_id;
};

const installChaincode = async () => {
    const packageChaincode = util.format(
        'peer lifecycle chaincode package %s -l node --label %s_v0 -p %s',
        '/tmp/scenario.tar.gz',
        'mysmartcontract',
        // the test folder containing scenario is mapped to /opt/gopath/src/github.com/chaincode
        '/opt/gopath/src/github.com/chaincode/scenario'
    );
    const peerInstall = util.format(
        'peer lifecycle chaincode install %s',
        '/tmp/scenario.tar.gz'
    );
    const npmrc = path.join(__dirname, '..', '..', 'test', 'chaincodes','scenario', '.npmrc');

    await runcmds([
        `echo "registry=http://${ip.address()}:4873" > ${npmrc}`,
        util.format(
            'docker exec %s %s',
            'org1_cli',
            packageChaincode
        ),
        util.format(
            'docker exec %s %s',
            'org1_cli',
            peerInstall
        ),
        util.format(
            'docker exec %s %s',
            'org2_cli',
            packageChaincode
        ),
        util.format(
            'docker exec %s %s',
            'org2_cli',
            peerInstall
        ),
        `rm -f ${npmrc}`
    ]);
};

const clientTests = series(installChaincode, instantiateChaincode, invokeFunctions, queryFunctions);
const serverTests = require('./server').default;

exports.default = series(clientTests);
