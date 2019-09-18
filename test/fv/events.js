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
const {LONG_STEP} = utils.TIMEOUTS;

describe('Chaincode events', async function () {
    const suite = 'events';

    before(async function () {
        this.timeout(LONG_STEP);

        return utils.installAndInstantiate(suite, 'org.mynamespace.events:instantiate');
    });

    it('should publish an event', async function () {
        this.timeout(LONG_STEP);

        const date = new Date().toISOString();
        await utils.invoke(suite, 'org.mynamespace.events:emit', [`my event data @ ${date}`]);
        const block = await utils.getLastBlock();
        expect(block.data.data.length).to.equal(1); // only one transaction
        const transaction = block.data.data[0];
        const actions = transaction.payload.data.actions;
        expect(actions.length).to.equal(1); // only one action
        const action = actions[0];
        const proposalResponsePayload = action.payload.action.proposal_response_payload;
        const events = proposalResponsePayload.extension.events;
        expect(events.chaincode_id).to.equal('events');
        expect(events.event_name).to.equal('myevent');
        const payload = Buffer.from(events.payload, 'base64').toString();
        expect(payload).to.equal(`my event data @ ${date}`);
    });

});
