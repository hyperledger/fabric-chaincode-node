/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const utils = require('./utils');
const {MED_STEP, LONG_STEP} = utils.TIMEOUTS;

describe('Chaincode clientidentity', () => {
    const suite = 'clientidentity';

    before(async function () {
        this.timeout(LONG_STEP);

        return utils.installAndInstantiate(suite, 'org.mynamespace.clientidentity:instantiate');
    });

    it('should create an instance of the client identity class', async function () {
        this.timeout(MED_STEP);

        const payload = JSON.parse(await utils.query(suite, 'org.mynamespace.clientidentity:clientIdentityInstance', []));
        expect(payload.mspId).to.equal('Org2MSP', 'Test mspId value');
        expect(payload.id).to.equal('x509::/C=US/ST=California/L=San Francisco/CN=Admin@org2.example.com::/C=US/ST=California/L=San Francisco/O=org2.example.com/CN=ca.org2.example.com', 'Test getID()');
    });

    it('should be able to check the peer MSPID', async function () {
        this.timeout(MED_STEP);

        const payload = JSON.parse(await utils.query(suite, 'org.mynamespace.clientidentity:localMspID', []));
        expect(payload.localMspID).to.equal('Org2MSP', 'Test stub.getMspID()');
    });

});