'use strict';

const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const path = require('path');

function getPackageVersion() {
    const packageJsonPath = path.join(__dirname, './../../package.json');
    const packageJson = fs.readFileSync(packageJsonPath);
    const version = JSON.parse(packageJson.toString()).version;
    return version;
}

async function packPackage(packageName, ccName) {
    const version = getPackageVersion();
    const p = path.join(__dirname, `../../${packageName}`);
    const packCmd = `cd ${p} && npm pack && mv ./${packageName}-${version}.tgz ../test/fv/${ccName}/`;
    await exec(packCmd);
}

async function packPackages(ccName) {
    await packPackage('fabric-contract-api', ccName);
    await packPackage('fabric-shim', ccName);
    await packPackage('fabric-shim-crypto', ccName);
}

async function deletePackage(packageName, ccName) {
    const version = getPackageVersion();
    const cmd = `rm ${__dirname}/${ccName}/${packageName}-${version}.tgz`;
    await exec(cmd);
}

async function deletePackages(ccName) {
    await deletePackage('fabric-contract-api', ccName);
    await deletePackage('fabric-shim', ccName);
    await deletePackage('fabric-shim-crypto', ccName);
}

async function install(ccName) {
    // const folderName = '/opt/gopath/src/github.com/fv/' + ccName;
    const folderName = '/etc/hyperledger/config/fv/' + ccName;
    const cmd = `docker exec cli peer chaincode install -l node -n ${ccName} -v v0 -p ${folderName}`;
    await exec(cmd);
}

async function instantiate(ccName) {
    const cmd = `docker exec cli peer chaincode instantiate ${getTLSArgs()} -o orderer.example.com:7050 -l node -C mychannel -n ${ccName} -v v0 -c '{"Args": ["org.mynamespace.${ccName}:instantiate"]}' -P 'OR ("Org1MSP.member")'`;
    const res = await exec(cmd);
    await new Promise(resolve => setTimeout(resolve, 5000));
    return res;
}

function printArgs(func, args) {
    if (!Array.isArray(args)) {
        args = [func];
    } else {
        args = [func, ...args];
    }
    for (const key in args) {
        args[key] = `${args[key]}`;
    }
    return JSON.stringify({Args: args});
}

async function invoke(ccName, func, args) {
    const cmd = `docker exec cli peer chaincode invoke ${getTLSArgs()} -o orderer.example.com:7050 -C mychannel -n ${ccName} -c '${printArgs(func, args)}' --waitForEvent 2>&1`;
    const {stdout, error} = await exec(cmd);
    if (error) {
        throw new Error(error);
    }
    return parsePayload(stdout);
}

async function query(ccName, func, args) {
    const cmd = `docker exec cli peer chaincode query ${getTLSArgs()} -C mychannel -n ${ccName} -c '${printArgs(func, args)}' 2>&1`;
    const {stdout, error} = await exec(cmd);
    if (error) {
        throw new Error(error);
    }
    return parsePayloadQuery(stdout);
}

function parsePayload(input) {
    // eslint-disable-next-line
    const regex = new RegExp(/INFO.*payload:(\".*?\") $/gm);
    const outputs = regex.exec(input);

    const payload = outputs[outputs.length - 1];
    const output = new Buffer(JSON.parse(payload));
    const jsonString = JSON.stringify(output.toString());
    let json = JSON.parse(jsonString);
    if (typeof json === 'string') {
        json = JSON.parse(json);
    }
    return json;
}

function parsePayloadQuery(input) {
    const regex = new RegExp(/\[([0-9,]*?)\]/g);
    const outputs = regex.exec(input);

    const output = new Buffer(JSON.parse(outputs[outputs.length - 2]));
    const jsonString = JSON.stringify(output.toString());
    let json = JSON.parse(jsonString);
    if (typeof json === 'string') {
        json = JSON.parse(json);
    }
    return json;
}

async function installAndInstantiate(ccName, args) {
    if (!args) {
        args = [];
    }
    await install(ccName);
    return instantiate(ccName);
}

function getTLSArgs() {
    let args = '';
    const tls = process.env.TLS ? process.env.TLS : 'false';
    if (tls === 'true') {
        args = util.format('--tls %s --cafile %s', tls,
            '/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem');
    }
    return args;
}

const TIMEOUTS = {
    LONG_STEP : 240 * 1000,
    MED_STEP : 120 * 1000,
    SHORT_STEP: 60 * 1000,
    LONG_INC : 30 * 1000,
    MED_INC : 10 * 1000,
    SHORT_INC: 5 * 1000
};

module.exports = {installAndInstantiate, invoke, query, packPackages, deletePackages, TIMEOUTS};
