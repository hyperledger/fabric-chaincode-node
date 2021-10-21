/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const util = require('util');
const childProcess = require('child_process');
const exec = util.promisify(childProcess.exec);
const fs = require('fs');
const path = require('path');
const ip = require('ip');
const execSync = require('child_process').execSync;

const ordererCA = '/test-network/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem';
const dir = path.join(__dirname, '..', '..', 'fabric-samples');
const registerAndEnroll = () => {
    const cmd = `export PATH="${dir}/bin:$PATH" && export FABRIC_CFG_PATH=${dir}/config/ && ` +
            `export FABRIC_CA_CLIENT_HOME=${dir}/test-network/organizations/peerOrganizations/org1.example.com/ && ` +
            `fabric-ca-client register --caname ca-org1 --id.name owner --id.secret ownerpw --id.type client --tls.certfiles "${dir}/test-network/organizations/fabric-ca/org1/tls-cert.pem" && ` +
            `fabric-ca-client enroll -u https://owner:ownerpw@localhost:7054 --caname ca-org1 -M "${dir}/test-network/organizations/peerOrganizations/org1.example.com/users/owner@org1.example.com/msp" --tls.certfiles "${dir}/test-network/organizations/fabric-ca/org1/tls-cert.pem" && ` +
            `cp "${dir}/test-network/organizations/peerOrganizations/org1.example.com/msp/config.yaml" "${dir}/test-network/organizations/peerOrganizations/org1.example.com/users/owner@org1.example.com/msp/config.yaml" && ` +
            `export FABRIC_CA_CLIENT_HOME=${dir}/test-network/organizations/peerOrganizations/org2.example.com/ && ` +
            `fabric-ca-client register --caname ca-org2 --id.name buyer --id.secret buyerpw --id.type client --tls.certfiles "${dir}/test-network/organizations/fabric-ca/org2/tls-cert.pem" && ` +
            `fabric-ca-client enroll -u https://buyer:buyerpw@localhost:8054 --caname ca-org2 -M "${dir}/test-network/organizations/peerOrganizations/org2.example.com/users/buyer@org2.example.com/msp" --tls.certfiles "${dir}/test-network/organizations/fabric-ca/org2/tls-cert.pem" && ` +
            `cp "${dir}/test-network/organizations/peerOrganizations/org2.example.com/msp/config.yaml" "${dir}/test-network/organizations/peerOrganizations/org2.example.com/users/buyer@org2.example.com/msp/config.yaml"`;
    execSync(cmd);
};
const getTLSArgs = () => {
    return `--tls true --cafile ${dir}` + ordererCA;
};

// Increase the timeouts on zLinux!
const arch = require('os').arch();
const multiplier = arch === 's390x' ? 2 : 1;

async function install(ccName, transient) {
    const npmrc = path.join(__dirname, '..', 'chaincodes', ccName, '.npmrc');
    try {
        fs.writeFileSync(npmrc, `registry=http://${ip.address()}:4873`);
        const networkScriptDir = path.join(__dirname, '..', '..', 'fabric-samples', 'test-network');
        const CCDir = path.join(__dirname, '..', 'chaincodes', ccName);
        const collectionConfig = transient ? `-cccg ${CCDir}/collection-config/collection.json` : '';
        const cmd = `cd ${networkScriptDir} && ./network.sh deployCC -ccn ${ccName} -ccp ${CCDir} -ccl javascript ${collectionConfig} -ccep "OR('Org1MSP.peer','Org2MSP.peer')"`;
        await exec(cmd);
    } finally {
        fs.unlinkSync(npmrc);
    }
}

async function instantiate(ccName, func, args) {
    let res = null;
    if (func !== undefined) {
        const initCmd = `export PATH="${dir}/bin:$PATH" && export FABRIC_CFG_PATH=${dir}/config/ && ` +
                `export CORE_PEER_TLS_ENABLED=true && export CORE_PEER_LOCALMSPID="Org1MSP" && ` +
                `export CORE_PEER_TLS_ROOTCERT_FILE=${dir}/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt && ` +
                `export CORE_PEER_MSPCONFIGPATH=${dir}/test-network/organizations/peerOrganizations/org1.example.com/users/owner@org1.example.com/msp && ` +
                `export CORE_PEER_ADDRESS=localhost:7051 && peer chaincode invoke ${getTLSArgs()} -o localhost:7050 -C mychannel -n ${ccName} -c '${printArgs(func, args)}' --waitForEvent`;
        res = await exec(initCmd);
    }
    return res;
}

function printArgs(func, args) {
    if (!Array.isArray(args) && func) {
        args = [func];
    } else if (func) {
        args = [func, ...args];
    } else {
        args = [];
    }
    for (const key in args) {
        args[key] = `${args[key]}`;
    }
    return JSON.stringify({Args: args});
}

async function invoke(ccName, func, args, transient) {
    let cmd = `export PATH="${dir}/bin:$PATH" && export FABRIC_CFG_PATH=${dir}/config/ && ` +
        `export CORE_PEER_TLS_ENABLED=true && export CORE_PEER_LOCALMSPID="Org1MSP" && ` +
        `export CORE_PEER_TLS_ROOTCERT_FILE=${dir}/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt && ` +
        `export CORE_PEER_MSPCONFIGPATH=${dir}/test-network/organizations/peerOrganizations/org1.example.com/users/owner@org1.example.com/msp && ` +
        `export CORE_PEER_ADDRESS=localhost:7051 && `;

    if (transient) {
        cmd += `peer chaincode invoke ${getTLSArgs()} -o localhost:7050 -C mychannel -n ${ccName} -c '${printArgs(func, args)}' --transient '${transient}' --waitForEvent --waitForEventTimeout 200s 2>&1`;
    } else {
        cmd += `peer chaincode invoke ${getTLSArgs()} -o localhost:7050 -C mychannel -n ${ccName} -c '${printArgs(func, args)}' --waitForEvent --waitForEventTimeout 100s 2>&1`;
    }
    const {stderr, stdout} = execSync(cmd);
    if (stderr) {
        throw new Error(stderr);
    }
}

async function query(ccName, func, args, transient) {
    let cmd = `export PATH="${dir}/bin:$PATH" && export FABRIC_CFG_PATH=${dir}/config/ && ` +
        `export CORE_PEER_TLS_ENABLED=true && export CORE_PEER_LOCALMSPID="Org2MSP" && ` +
        `export CORE_PEER_TLS_ROOTCERT_FILE=${dir}/test-network/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt && ` +
        `export CORE_PEER_MSPCONFIGPATH=${dir}/test-network/organizations/peerOrganizations/org2.example.com/users/buyer@org2.example.com/msp && ` +
        `export CORE_PEER_ADDRESS=localhost:9051 && `;

    if (transient) {
        cmd += `peer chaincode query ${getTLSArgs()} -C mychannel -n ${ccName} -c '${printArgs(func, args)}' --transient '${transient}' 2>&1`;
    } else {
        cmd += `peer chaincode query ${getTLSArgs()} -C mychannel -n ${ccName} -c '${printArgs(func, args)}' 2>&1`;
    }
    const {error, stdout, stderr} = await exec(cmd);
    if (error) {
        throw new Error(error, stderr);
    }

    return  stdout.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"'); // remove surrounding quotes and unescape
}

async function installAndInstantiate(ccName, instantiateFunc, instantiateArgs, transient = false) {
    await install(ccName, transient);
    return instantiate(ccName, instantiateFunc, instantiateArgs);
}

async function getLastBlock() {
    const cmd = `export PATH="${dir}/bin:$PATH" && export FABRIC_CFG_PATH=${dir}/config/ && ` +
        `export CORE_PEER_TLS_ENABLED=true && export CORE_PEER_LOCALMSPID="Org2MSP" && ` +
        `export CORE_PEER_TLS_ROOTCERT_FILE=${dir}/test-network/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt && ` +
        `export CORE_PEER_MSPCONFIGPATH=${dir}/test-network/organizations/peerOrganizations/org2.example.com/users/buyer@org2.example.com/msp && ` +
        `export CORE_PEER_ADDRESS=localhost:9051 && ` +
        'peer channel fetch newest -c mychannel /tmp/mychannel.block && configtxlator proto_decode --type common.Block --input=/tmp/mychannel.block --output=/tmp/output && cat /tmp/output';
    const {error, stdout, stderr} = await exec(cmd);
    if (error) {
        throw new Error(error, stderr);
    }
    return JSON.parse(stdout.trim());
}

const TIMEOUTS = {
    LONGEST_STEP : 24000 * 1000 * multiplier,
    LONG_STEP : 240 * 1000 * multiplier,
    MED_STEP : 120 * 1000 * multiplier,
    SHORT_STEP: 60 * 1000 * multiplier,
    LONG_INC : 30 * 1000 * multiplier,
    MED_INC : 10 * 1000 * multiplier,
    SHORT_INC: 5 * 1000 * multiplier
};
module.exports = {installAndInstantiate, invoke, query, getLastBlock, TIMEOUTS, registerAndEnroll};
