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

const org1CA = '/etc/hyperledger/config/crypto-config/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem';
const org2CA = '/etc/hyperledger/config/crypto-config/peerOrganizations/org2.example.com/tlsca/tlsca.org2.example.com-cert.pem';
const ordererCA = '/etc/hyperledger/config/crypto-config/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem';
const tls = process.env.TLS && process.env.TLS.toLowerCase() === 'true' ? true : false;
const getTLSArgs = () => {
    if (tls) {
        return '--tls true --cafile ' + ordererCA;
    }

    return '';
};
const getPeerAddresses = () => {
    if (tls) {
        return '--peerAddresses peer0.org1.example.com:7051 --tlsRootCertFiles ' + org1CA +
            ' --peerAddresses peer0.org2.example.com:8051 --tlsRootCertFiles ' + org2CA;
    } else {
        return '--peerAddresses peer0.org1.example.com:7051' +
            ' --peerAddresses peer0.org2.example.com:8051';
    }
};
const findPackageId = (queryOutput, label) => {
    const output = JSON.parse(queryOutput);

    const cc = output.installed_chaincodes.filter((chaincode) => chaincode.label === label);
    if (cc.length !== 1) {
        throw new Error('Failed to find installed chaincode');
    }

    return cc[0].package_id;
};

// Increase the timeouts on zLinux!
const arch = require('os').arch();
const multiplier = arch === 's390x' ? 2 : 1;

async function install(ccName) {
    const npmrc = path.join(__dirname, '..', 'chaincodes', ccName, '.npmrc');
    try {
        fs.writeFileSync(npmrc, `registry=http://${ip.address()}:4873`);
        const folderName = '/opt/gopath/src/github.com/chaincode/' + ccName;
        const packageCmd = `docker exec %s peer lifecycle chaincode package -l node /tmp/${ccName}.tar.gz -p ${folderName} --label ${ccName}_v0`;
        await exec(util.format(packageCmd, 'org1_cli'));
        await exec(util.format(packageCmd, 'org2_cli'));

        const installCmd = `docker exec %s peer lifecycle chaincode install /tmp/${ccName}.tar.gz --connTimeout 60s`;
        await exec(util.format(installCmd, 'org1_cli'));
        await exec(util.format(installCmd, 'org2_cli'));
    } finally {
        fs.unlinkSync(npmrc);
    }
}

async function instantiate(ccName, func, args) {
    const orgs = ['org1', 'org2'];
    const endorsementPolicy = '\'OR ("Org1MSP.member")\'';

    for (const org of orgs) {
        const queryInstalledCmd = `docker exec ${org}_cli peer lifecycle chaincode queryinstalled --output json`;
        const res = await exec(queryInstalledCmd);
        const pkgId = findPackageId(res.stdout.toString(), ccName + '_v0');
        const approveCmd = `docker exec ${org}_cli peer lifecycle chaincode approveformyorg ${getTLSArgs()} -o orderer.example.com:7050` +
            ` -C mychannel -n ${ccName} -v v0 --init-required --sequence 1 --package-id ${pkgId} --signature-policy ${endorsementPolicy}`;

        await exec(approveCmd);
    }

    const commitCmd = `docker exec org1_cli peer lifecycle chaincode commit ${getTLSArgs()} -o orderer.example.com:7050` +
        ` -C mychannel -n ${ccName} -v v0 --init-required --sequence 1 --signature-policy ${endorsementPolicy} ${getPeerAddresses()}`;

    console.log(commitCmd);
    await exec(commitCmd);
    await new Promise(resolve => setTimeout(resolve, 5000));

    const initCmd = `docker exec org1_cli peer chaincode invoke ${getTLSArgs()} -o orderer.example.com:7050 -C mychannel -n ${ccName} --isInit -c '${printArgs(func, args)}' --waitForEvent`;
    const res = await exec(initCmd);

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
