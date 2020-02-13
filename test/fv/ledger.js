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
const {SHORT_STEP, MED_STEP, LONG_STEP} = utils.TIMEOUTS;

describe('Chaincode ledger', () => {
    const suite = 'ledger';

    before(async function () {
        this.timeout(LONG_STEP);

        return utils.installAndInstantiate(suite);
    });

    it('should be able to use the ledger API', async function () {
        this.timeout(LONG_STEP);

        const payload = await utils.query(suite, 'org.example.ledger:getLedger', ['']);
        expect(payload).to.equal('success');
    });
});
