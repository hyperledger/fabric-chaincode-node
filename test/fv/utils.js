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


const ordererCA = '/etc/hyperledger/config/crypto-config/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem';
const tls = process.env.TLS && process.env.TLS.toLowerCase() === 'true' ? true : false;
const getTLSArgs = () => {
    if (tls) {
        return '--tls true --cafile ' + ordererCA;
    }

    return '';
};


// Increase the timeouts on zLinux!
const arch = require('os').arch();
const multiplier = arch === 's390x' ? 2 : 1;

async function install(ccName) {
    const npmrc = path.join(__dirname, '..', 'chaincodes', ccName, '.npmrc');
    try {
        fs.writeFileSync(npmrc, `registry=http://${ip.address()}:4873`);
        const folderName = '/opt/gopath/src/github.com/chaincode/' + ccName;
        const cmd = `docker exec %s peer chaincode install -l node -n ${ccName} -v v0 -p ${folderName} --connTimeout 180s`;
        await exec(util.format(cmd, 'org1_cli'));
        await exec(util.format(cmd, 'org2_cli'));

    } finally {
        fs.unlinkSync(npmrc);
    }
}

async function instantiate(ccName, func, args) {
    const cmd = `docker exec org1_cli peer chaincode instantiate ${getTLSArgs()} -o orderer.example.com:7050 -l node -C mychannel -n ${ccName} -v v0 -c '${printArgs(func, args)}' -P 'OR ("Org1MSP.member")'`;
    console.log(cmd);
    const res = await exec(cmd);
    await new Promise(resolve => setTimeout(resolve, 5000));
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
    let cmd;

    if (transient) {
        cmd = `docker exec org1_cli peer chaincode invoke ${getTLSArgs()} -o orderer.example.com:7050 -C mychannel -n ${ccName} -c '${printArgs(func, args)}' --transient '${transient}' --waitForEvent --waitForEventTimeout 100s 2>&1`;
    } else {
        cmd = `docker exec org1_cli peer chaincode invoke ${getTLSArgs()} -o orderer.example.com:7050 -C mychannel -n ${ccName} -c '${printArgs(func, args)}' --waitForEvent --waitForEventTimeout 100s 2>&1`;
    }

    const {stderr} = await exec(cmd);
    if (stderr) {
        throw new Error(stderr);
    }
}

async function query(ccName, func, args, transient) {
    let cmd;

    if (transient) {
        cmd = `docker exec org2_cli peer chaincode query ${getTLSArgs()} -C mychannel -n ${ccName} -c '${printArgs(func, args)}' --transient '${transient}' 2>&1`;
    } else {
        cmd = `docker exec org2_cli peer chaincode query ${getTLSArgs()} -C mychannel -n ${ccName} -c '${printArgs(func, args)}' 2>&1`;
    }
    const {error, stdout, stderr} = await exec(cmd);
    if (error) {
        throw new Error(error, stderr);
    }

    return  stdout.trim().replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"'); // remove surrounding quotes and unescape
}

async function installAndInstantiate(ccName, instantiateFunc, instantiateArgs) {
    await install(ccName);
    return instantiate(ccName, instantiateFunc, instantiateArgs);
}

async function getLastBlock() {
    const cmd = 'docker exec org1_cli bash -c "peer channel fetch newest -c mychannel /tmp/mychannel.block && configtxlator proto_decode --type common.Block --input=/tmp/mychannel.block"';
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
module.exports = {installAndInstantiate, invoke, query, getLastBlock, TIMEOUTS};
