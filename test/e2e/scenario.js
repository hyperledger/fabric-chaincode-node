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
const dir = path.join(__dirname, '..', '..', 'fabric-samples');
const exportPeerCommand = async(org) => {
    const port = org === 'org1' ? 7051 : 9051;
    const role = 'Admin';
    const args = `export PATH=${dir}/bin:$PATH && export FABRIC_CFG_PATH=${dir}/config/ && ` +
        `export CORE_PEER_TLS_ENABLED=true && export CORE_PEER_LOCALMSPID="${org[0].toUpperCase() + org.slice(1)}MSP" && ` +
        `export CORE_PEER_TLS_ROOTCERT_FILE=${dir}/test-network/organizations/peerOrganizations/${org}.example.com/peers/peer0.${org}.example.com/tls/ca.crt && ` +
        `export CORE_PEER_MSPCONFIGPATH=${dir}/test-network/organizations/peerOrganizations/${org}.example.com/users/${role}@${org}.example.com/msp && ` +
        `export CORE_PEER_ADDRESS=localhost:${port}`;
    return args;
}

const invokeFunctions = async () => {
    const args = await exportPeerCommand('org1') + ' && ' + util.format(
        'peer chaincode invoke -o localhost:7050 %s -C %s -n %s -c %s --waitForEvent',
        getTLSArgs(),
        CHANNEL_NAME,
        'mysmartcontract',
        '\'{"Args":["setNewAssetValue","\'42\'"]}\'');

    await runcmds([args]);
};

const queryFunctions = async () => {
    const args = await exportPeerCommand('org2') +  ' && ' + util.format(
        'peer chaincode query -o localhost:7050 %s -C %s -n %s -c %s',
        getTLSArgs(),
        CHANNEL_NAME,
        'mysmartcontract',
        '\'{"Args":["org.hyperledger.fabric:GetMetadata"]}\'');

    const stdoutList = await runcmds([args]);
    const stdout = stdoutList[0];
    // validate the stdout/stderr
    console.log(stdout);

    const metadata = JSON.parse(stdout);

    const expectedMetadata = '{"$schema":"https://hyperledger.github.io/fabric-chaincode-node/main/api/contract-schema.json","contracts":{"UpdateValues":{"name":"UpdateValues","contractInstance":{"name":"UpdateValues","logBuffer":{"output":[]},"default":true},"transactions":[{"name":"setup","tags":["SUBMIT","submitTx"]},{"name":"setNewAssetValue","tags":["SUBMIT","submitTx"],"parameters":[{"name":"arg0","description":"Argument 0","schema":{"type":"string"}}]},{"name":"doubleAssetValue","tags":["SUBMIT","submitTx"]}],"info":{"title":"","version":""}},"RemoveValues":{"name":"RemoveValues","contractInstance":{"name":"RemoveValues"},"transactions":[{"name":"quarterAssetValue","tags":["SUBMIT","submitTx"]},{"name":"getAssetValue","tags":["SUBMIT","submitTx"]}],"info":{"title":"","version":""}},"org.hyperledger.fabric":{"name":"org.hyperledger.fabric","contractInstance":{"name":"org.hyperledger.fabric"},"transactions":[{"name":"GetMetadata"}],"info":{"title":"","version":""}}},"info":{"version":"2.4.3-unstable","title":"chaincode"},"components":{"schemas":{}}}';

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
    // Invoke init function
    await runcmds([
        await exportPeerCommand('org1') + ' && ' +
        util.format(
            'peer chaincode invoke -o localhost:7050 %s -C %s -n %s -c %s --waitForEvent',
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

    const CCDir = path.join(__dirname, '..', 'chaincodes', 'scenario');

    await runcmds([
        `echo "registry=http://${ip.address()}:4873" > ${npmrc}`,
        util.format(
            await exportPeerCommand('org1') + ' && ',
            `cd ${dir}/test-network && ./network.sh deployCC -ccn mysmartcontract -ccp ${CCDir} -ccl javascript -ccep "OR('Org1MSP.peer','Org2MSP.peer')"`
        )
    ]);
};

const clientTests = series(installChaincode, instantiateChaincode, invokeFunctions, queryFunctions);
const serverTests = require('./server').default;

exports.default = series(clientTests);
