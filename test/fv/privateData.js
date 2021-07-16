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

describe('Chaincode privateData', () => {
    const suite = 'privateData';

    before(async function () {
        this.timeout(LONG_STEP);
        console.log('Installing suite');
        return utils.installAndInstantiate(suite);
    });

    it.only('should write and read an asset with private data', async function () {
        this.timeout(MED_STEP);
        console.log('Create Asset');
        await utils.invoke(suite, 'privateDataContract:createAsset', ['1'], '{"privateValue":"privateData"}');
        console.log('Create Asset1');
        const payload = await utils.query(suite, 'privateDataContract:readAsset', ['1']);
        console.log('Create Asset2');
        expect(payload).to.eql('privateData');
        console.log(payload);
    });

    it('should update an asset with private data', async function () {
        this.timeout(MED_STEP);
        await utils.invoke(suite, 'privateDataContract:createAsset', ['1'], '{"privateValue":"privateData"}');
        await utils.invoke(suite, 'privateDataContract:updateAsset', ['1'], '{"privateValue":"updatedPrivateData"}');
        const payload = await utils.query(suite, 'privateDataContract:readAsset', ['1']);
        expect(payload).to.eql('updatedPrivateData');
    });

    it('should delete an asset with private data', async function () {
        this.timeout(MED_STEP);
        await utils.invoke(suite, 'privateDataContract:createAsset', ['1'], '{"privateValue":"privateData"}');
        expect(payload).to.eql('privateData');
        await utils.invoke(suite, 'privateDataContract:deleteAsset', ['1']);
        const payload = await utils.query(suite, 'privateDataContract:assetExists', ['1']);
        expect(payload).to.eql(false);
    });

});