/*
 * Copyright contributors to Hyperledger Fabric.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const path = require('path');

const ordererCA = '/test-network/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem';
const org1CA = '/etc/hyperledger/config/crypto-config/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem';
const org2CA = '/etc/hyperledger/config/crypto-config/peerOrganizations/org2.example.com/tlsca/tlsca.org2.example.com-cert.pem';
const dir = path.join(__dirname, '..', '..', 'fabric-samples');

const tls = process.env.TLS && process.env.TLS.toLowerCase() === 'true' ? true : false;

exports.tls = tls;

exports.getTLSArgs = () => {
    return `--tls true --cafile ${dir}` + ordererCA;
};

exports.getPeerAddresses = () => {
    if (tls) {
        return '--peerAddresses peer0.org1.example.com:7051 --tlsRootCertFiles ' + org1CA +
            ' --peerAddresses peer0.org2.example.com:8051 --tlsRootCertFiles ' + org2CA;
    } else {
        return '--peerAddresses peer0.org1.example.com:7051' +
            ' --peerAddresses peer0.org2.example.com:8051';
    }
};
