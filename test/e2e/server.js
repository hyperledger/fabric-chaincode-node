/*
# Copyright Hitachi America, Ltd. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const {series} = require('gulp');

const util = require('util');
const path = require('path');

const { shell: runcmds , getTLSArgs, getPeerAddresses } = require('toolchain');
const ip = require('ip');

const CHANNEL_NAME = 'mychannel';

const chaincodeDir = path.join(__dirname, '..', '..', 'test', 'chaincodes', 'server');

async function packageChaincode() {
    await runcmds([
        util.format(
            'tar -C %s/package -cvzf %s/package/code.tar.gz connection.json',
            chaincodeDir, chaincodeDir
        ),
        util.format(
            'tar -C %s/package -cvzf %s/package/chaincode.tar.gz code.tar.gz metadata.json',
            chaincodeDir, chaincodeDir
        ),
    ]);
}

async function buildChaincode() {
    const npmrc = path.join(chaincodeDir, '.npmrc');

    await runcmds([
        `echo "registry=http://${ip.address()}:4873" > ${npmrc}`,
        util.format(
            'docker build --no-cache -t chaincode-e2e-server %s',
            chaincodeDir
        ),
        `rm -f ${npmrc}`
    ]);
}

async function installChaincode() {
    const peerInstall = 'peer lifecycle chaincode install /opt/gopath/src/github.com/chaincode/server/package/chaincode.tar.gz';

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
        )
    ]);
};

function findPackageId(queryOutput, label) {
    const output = JSON.parse(queryOutput);

    const cc = output.installed_chaincodes.filter((chaincode) => chaincode.label === label);
    if (cc.length !== 1) {
        throw new Error('Failed to find installed chaincode');
    }

    return cc[0].package_id;
}

async function instantiateChaincode() {
    const endorsementPolicy = '"OR (\'Org1MSP.member\', \'Org2MSP.member\')"';
    const queryInstalled = util.format(
        'peer lifecycle chaincode queryinstalled --output json'
    );
    const sequence = 1;

    const approveChaincode = util.format(
        'peer lifecycle chaincode approveformyorg -o %s %s -C %s -n %s -v %s --package-id %s --sequence %d --signature-policy %s',
        'orderer.example.com:7050',
        getTLSArgs(),
        CHANNEL_NAME,
        'server',
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

    const packageIdOrg1 = findPackageId(outputs[0], 'server_v0');
    const packageIdOrg2 = findPackageId(outputs[1], 'server_v0');

    // TODO: Assuming the two package IDs are the same
    await runcmds([
        // Start the CC Server container
        `docker run -e CORE_CHAINCODE_ID=${packageIdOrg1} -e CORE_CHAINCODE_ADDRESS=0.0.0.0:9999 -h cc-server --name cc-server -d --network node_default chaincode-e2e-server`,
        // Approve the chaincode definition by each org
        util.format('docker exec %s %s',
            'org1_cli',
            util.format(approveChaincode, packageIdOrg1)
        ),
        util.format('docker exec %s %s',
            'org2_cli',
            util.format(approveChaincode, packageIdOrg2)
        ),
        // Commit the chaincode definition
        util.format('docker exec org1_cli peer lifecycle chaincode commit -o %s %s -C %s -n %s -v %s --sequence %d --signature-policy %s %s',
            'orderer.example.com:7050',
            getTLSArgs(),
            CHANNEL_NAME,
            'server',
            'v0',
            sequence,
            endorsementPolicy,
            getPeerAddresses()
        )
    ]);
}

const invokeFunctions = async () => {
    const args = util.format('docker exec org1_cli peer chaincode invoke %s -C %s -n %s -c %s --waitForEvent',
        getTLSArgs(),
        CHANNEL_NAME,
        'server',
        '\'{"Args":["putValue","\'42\'"]}\'');

    await runcmds([args]);
};

const queryFunctions = async () => {
    const args = util.format('docker exec org1_cli peer chaincode query %s -C %s -n %s -c %s',
        getTLSArgs(),
        CHANNEL_NAME,
        'server',
        '\'{"Args":["getValue"]}\'');

    const ret = await runcmds([args]);

    const response = JSON.parse(ret[0]);

    if (response !== 42) {
        throw new Error("Unexpected result from chaincode");
    }
}

exports.default = series(
    packageChaincode, buildChaincode, installChaincode, instantiateChaincode,
    invokeFunctions, queryFunctions
);
