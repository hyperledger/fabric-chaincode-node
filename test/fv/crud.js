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
// eslint-disable-next-line no-unused-vars
const {SHORT_STEP, MED_STEP, LONG_STEP} = utils.TIMEOUTS;

describe('Chaincode CRUD', () => {
    const suite = 'crud';

    before(async function () {
        this.timeout(LONG_STEP);

        return utils.installAndInstantiate(suite, 'org.mynamespace.crud:instantiate');
    });

    describe('Get', () => {

        it('should get single key value', async function () {
            this.timeout(LONG_STEP);

            const payload = await utils.query(suite, 'org.mynamespace.crud:getKey', ['string']);
            expect(payload).to.equal('string');
        });

        it('should get a single key containing json data', async function() {
            this.timeout(SHORT_STEP);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getKey', ['jsonkey1']);
            expect(JSON.parse(payload)).to.deep.equal({value: 'value1'});
        });

        it('should get a single composite key value', async function () {
            this.timeout(SHORT_STEP);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getCompositeKey', ['ann', 'black']);
            expect(payload).to.equal('annblack');
        });

        it('should return a list of results from a partial composite key using the old iterator style', async function() {
            this.timeout(SHORT_STEP);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getPartialCompositeKey', ['ann']);
            expect(JSON.parse(payload)).to.deep.equal(['annblack', 'annred', 'annyellow']);
        });

        it('should return all keys between key1 and key3 using the old iterator style', async function() {
            this.timeout(SHORT_STEP);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getKeysByRange', ['key1', 'key4']);
            expect(JSON.parse(payload)).to.deep.equal(['value1', 'value2', 'value3']);
        });

        it('should return a paginated list using the old iterator style', async function () {
            this.timeout(SHORT_STEP);

            const payload1 = await utils.query(suite, 'org.mynamespace.crud:getStateByRangeWithPagination', ['key1', 'key4', 2, 'key2']);
            expect(JSON.parse(payload1)).to.deep.equal(['value2', 'value3']);
            const payload2 = await utils.query(suite, 'org.mynamespace.crud:getStateByRangeWithPagination', ['key1', 'key4', 3, '']);
            expect(JSON.parse(payload1)).to.deep.equal(['value2', 'value3']);
            expect(JSON.parse(payload2)).to.deep.equal(['value1', 'value2', 'value3']);
        });

        it('should return a state from a partial composite key using the old iterator style', async function() {
            this.timeout(SHORT_STEP);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getStateByPartialCompositeKey', ['name~color', 'ann']);
            expect(JSON.parse(payload)).to.deep.equal(['annblack', 'annred', 'annyellow']);
        });

        it('should return a paginated list from partial composte key', async function() {
            this.timeout(SHORT_STEP);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getStateByPartialCompositeKeyWithPagination', ['name~color', 1]);
            expect(JSON.parse(payload)).to.deep.equal(['annblack']);
        });
    });

    describe('Put', () => {
        it('should add a key', async function() {
            this.timeout(SHORT_STEP);
            await utils.invoke(suite, 'org.mynamespace.crud:putKey', ['newKey1', 'newValue1']);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getKey', ['newKey1']);
            expect(payload).to.equal('newValue1');
        });

        it('should add a composite key', async function() {
            this.timeout(SHORT_STEP);
            await utils.invoke(suite, 'org.mynamespace.crud:putCompositeKey', ['tim', 'green', 'newCompositeValue']);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getCompositeKey', ['tim', 'green']);
            expect(payload).to.equal('newCompositeValue');
        });

        it('should update an existing key', async function() {
            this.timeout(SHORT_STEP);
            await utils.invoke(suite, 'org.mynamespace.crud:putKey', ['key1', 'updatedValue1']);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getKey', ['key1']);
            expect(payload).to.equal('updatedValue1');
        });
    });

    describe('Delete', () => {
        it('should delete a key', async function() {
            this.timeout(SHORT_STEP);
            await utils.invoke(suite, 'org.mynamespace.crud:deleteKey', ['key2']);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getKey', ['key2']);
            expect(payload).to.equal('');
        });

        it('should delete a composite key', async function() {
            this.timeout(SHORT_STEP);
            await utils.invoke(suite, 'org.mynamespace.crud:deleteCompositeKey', ['tim', 'green']);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getCompositeKey', ['tim', 'green']);
            expect(payload).to.equal('');
        });

    });

    /*
    * This test is to be implemented when the new basic network has been created,
    * as key level endorsement is not enabled with this current basic_network
    */

    // describe('Set', () => {

    //     it('should set and get the state validation parameter', async function () {
    //         this.timeout(SHORT_STEP);
    //         await utils.invoke(suite, 'org.mynamespace.crud:setStateValidationParameter', ['key1']);
    //         const payload = JSON.parse(await utils.query(suite, 'org.mynamespace.crud:getStateValidationParameter', ['key1', 'key2']));
    //         expect(payload.ep.listOrgs()).to.deep.eql(['Org1MSP']);
    //         expect(payload.epBuffer2).to.be.undefined;
    //     });

    // });
});
