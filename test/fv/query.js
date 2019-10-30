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
const {MED_INC, LONG_STEP} = utils.TIMEOUTS;


describe('Chaincode query', () => {
    const suite = 'query';
    before(async function () {
        this.timeout(LONG_STEP);
        return utils.installAndInstantiate(suite, 'org.mynamespace.query:instantiate');
    });

    it('should perform an equals query', async function () {
        this.timeout(MED_INC);
        const query = JSON.stringify({
            selector: {
                value: 'value0'
            }
        });
        const payload = await utils.query(suite, 'org.mynamespace.query:query', [query]);
        expect(payload).to.deep.equal(JSON.stringify([{value: 'value0'}]));
    });

    it('should perform an regex query', async function () {
        this.timeout(MED_INC);
        const query = JSON.stringify({
            selector: {
                value: {
                    $regex: 'value[0-2]'
                }
            }
        });
        const payload = await utils.query(suite, 'org.mynamespace.query:query', [query]);
        expect(payload).to.deep.equal(JSON.stringify([
            {value: 'value0'},
            {value: 'value1'},
            {value: 'value2'}
        ]));
    });
});
