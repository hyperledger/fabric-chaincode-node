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
        return utils.installAndInstantiate(suite, null, null, true);
    });

    it('should write and read an asset with private data', async function () {
        this.timeout(MED_STEP);
        const privateData = Buffer.from('privateData').toString('base64');
        await utils.invoke(suite, 'privateDataContract:createAsset', ['1'], `{"privateValue":"${privateData}"}`);
        const payload = await utils.query(suite, 'privateDataContract:readAsset', ['1']);
        expect(payload).to.eql('{"privateValue":"privateData"}');
    });

    it('should update an asset with private data', async function () {
        this.timeout(MED_STEP);
        let privateData = Buffer.from('privateData').toString('base64');
        await utils.invoke(suite, 'privateDataContract:createAsset', ['2'], `{"privateValue":"${privateData}"}`);
        privateData = Buffer.from('updatedPrivateData').toString('base64');
        await utils.invoke(suite, 'privateDataContract:updateAsset', ['2'], `{"privateValue":"${privateData}"}`);
        const payload = await utils.query(suite, 'privateDataContract:readAsset', ['2']);
        expect(payload).to.eql('{"privateValue":"updatedPrivateData"}');
    });

    it('should delete an asset with private data', async function () {
        this.timeout(MED_STEP);
        const privateData = Buffer.from('privateData').toString('base64');
        await utils.invoke(suite, 'privateDataContract:createAsset', ['3'], `{"privateValue":"${privateData}"}`);
        let payload = await utils.query(suite, 'privateDataContract:readAsset', ['3']);
        expect(payload).to.eql('{"privateValue":"privateData"}');
        await utils.invoke(suite, 'privateDataContract:deleteAsset', ['3']);
        payload = await utils.query(suite, 'privateDataContract:assetExists', ['3']);
        expect(payload).to.eql('false');
    });

});