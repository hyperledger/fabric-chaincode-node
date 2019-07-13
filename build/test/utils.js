/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';
/* eslint-disable no-console*/
const delay = require('delay');

const ordererCA = '/etc/hyperledger/config/crypto-config/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem';

const tls = process.env.TLS && process.env.TLS.toLowerCase() === 'true' ? true : false;

exports.tls = tls;

exports.getTLSArgs = () => {
    if (tls) {
        return '--tls true --cafile ' + ordererCA;
    }

    return '';
};


const _delay = async () => {
    await delay(3000);
};

exports._delay = _delay;
