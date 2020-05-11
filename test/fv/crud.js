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
            expect(JSON.parse(payload)).to.deep.equal({key: 'k1', value: 'value1'});
        });

        it('should get multiple keys concurrently', async function () {
            this.timeout(SHORT_STEP);

            const payload = await utils.query(suite, 'org.mynamespace.crud:getKeysConcurrently', ['key1', 'key2', 'key3']);
            expect(JSON.parse(payload)).to.deep.equal(['value1', 'value2', 'value3']);
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

        it('should return a list of results from a partial composite key using the new iterator style', async function() {
            this.timeout(SHORT_STEP);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getPartialCompositeKeyUsingAsyncIterator', ['ann']);
            expect(JSON.parse(payload)).to.deep.equal(['annblack', 'annred', 'annyellow']);
        });


        it('should return all keys between key1 and key3 using the old iterator style', async function() {
            this.timeout(SHORT_STEP);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getKeysByRange', ['key1', 'key4']);
            expect(JSON.parse(payload)).to.deep.equal(['value1', 'value2', 'value3']);
        });

        it('should return all keys between key1 and key3 using the new iterator style', async function() {
            this.timeout(SHORT_STEP);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getKeysByRangeUsingAsyncIterator', ['key1', 'key4']);
            expect(JSON.parse(payload)).to.deep.equal(['value1', 'value2', 'value3']);
        });

        it('should get the history for a key using the old and new iterator style', async function () {
            this.timeout(LONG_STEP);

            await utils.invoke(suite, 'org.mynamespace.crud:putKey', ['key1', 'newValue1']);
            await utils.invoke(suite, 'org.mynamespace.crud:putKey', ['key1', 'newValue2']);
            await utils.invoke(suite, 'org.mynamespace.crud:putKey', ['key1', 'newValue3']);
            await utils.invoke(suite, 'org.mynamespace.crud:putKey', ['key1', 'value1']);

            let payload = await utils.query(suite, 'org.mynamespace.crud:getHistoryForKey', ['key1']);
            expect(JSON.parse(payload)).to.deep.equal(['value1', 'newValue3', 'newValue2', 'newValue1', 'value1']);

            payload = await utils.query(suite, 'org.mynamespace.crud:getHistoryForKeyUsingAsyncIterator', ['key1']);
            expect(JSON.parse(payload)).to.deep.equal(['value1', 'newValue3', 'newValue2', 'newValue1', 'value1']);

        });

        it('should get a query result with pagination without setting a bookmark using the old iterator style', async function () {
            this.timeout(MED_STEP);

            const payload = JSON.parse(await utils.query(suite, 'org.mynamespace.crud:getQueryResultWithPagination', []));
            expect(payload.results1.length).to.equal(2, 'Should return 2 keys');
            expect(payload.results1).to.deep.equal(['jsonkey0', 'jsonkey1']);
            expect(payload.metadata1.fetchedRecordsCount).to.equal(2);
            expect(payload.metadata1.bookmark).to.exist;
        });

        it('should get a query result with pagination without setting a bookmark using the new iterator style', async function () {
            this.timeout(MED_STEP);

            const payload = JSON.parse(await utils.query(suite, 'org.mynamespace.crud:getQueryResultWithPaginationUsingAsyncIterator', []));
            expect(payload.results1.length).to.equal(2, 'Should return 2 keys');
            expect(payload.results1).to.deep.equal(['jsonkey0', 'jsonkey1']);
            expect(payload.metadata1.fetchedRecordsCount).to.equal(2);
            expect(payload.metadata1.bookmark).to.exist;
        });


        it('should get a query result with pagination with a set bookmark using the old iterator style', async function () {
            this.timeout(MED_STEP);

            const payload = JSON.parse(await utils.query(suite, 'org.mynamespace.crud:getQueryResultWithPagination', []));
            expect(payload.results2.length).to.equal(1);
            expect(payload.results2).to.deep.equal(['jsonkey2']);
            expect(payload.metadata2.fetchedRecordsCount).to.equal(1);
        });

        it('should get a query result with pagination with a set bookmark using the new iterator style', async function () {
            this.timeout(MED_STEP);

            const payload = JSON.parse(await utils.query(suite, 'org.mynamespace.crud:getQueryResultWithPaginationUsingAsyncIterator', []));
            expect(payload.results2.length).to.equal(1);
            expect(payload.results2).to.deep.equal(['jsonkey2']);
            expect(payload.metadata2.fetchedRecordsCount).to.equal(1);
        });


        it('should return a paginated list using the old iterator style', async function () {
            this.timeout(SHORT_STEP);

            const payload1 = await utils.query(suite, 'org.mynamespace.crud:getStateByRangeWithPagination', ['key1', 'key4', 2, 'key2']);
            const payload2 = await utils.query(suite, 'org.mynamespace.crud:getStateByRangeWithPagination', ['key1', 'key4', 3, '']);
            expect(JSON.parse(payload1)).to.deep.equal(['value2', 'value3']);
            expect(JSON.parse(payload2)).to.deep.equal(['value1', 'value2', 'value3']);
        });

        it('should return a paginated list using the new iterator style', async function () {
            this.timeout(SHORT_STEP);

            const payload1 = await utils.query(suite, 'org.mynamespace.crud:getStateByRangeWithPaginationUsingAsyncIterator', ['key1', 'key4', 2, 'key2']);
            const payload2 = await utils.query(suite, 'org.mynamespace.crud:getStateByRangeWithPaginationUsingAsyncIterator', ['key1', 'key4', 3, '']);
            expect(JSON.parse(payload1)).to.deep.equal(['value2', 'value3']);
            expect(JSON.parse(payload2)).to.deep.equal(['value1', 'value2', 'value3']);
        });


        it('should return a state from a partial composite key using the old iterator style', async function() {
            this.timeout(SHORT_STEP);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getStateByPartialCompositeKey', ['name~color', 'ann']);
            expect(JSON.parse(payload)).to.deep.equal(['annblack', 'annred', 'annyellow']);
        });


        it('should return the bulk states from a partial composite key using the old iterator style', async function() {
            this.timeout(MED_STEP);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getStateByPartialCompositeKey', ['bulk-data','bulk']);
            expect(JSON.parse(payload)).to.have.lengthOf(229);
        });

        it('should return a state from a partial composite key using the new iterator style', async function() {
            this.timeout(SHORT_STEP);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getStateByPartialCompositeKeyUsingAsyncIterator', ['name~color', 'ann']);
            expect(JSON.parse(payload)).to.deep.equal(['annblack', 'annred', 'annyellow']);
        });

        it('should return a paginated list from partial composte key using the old iterator style', async function() {
            this.timeout(SHORT_STEP);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getStateByPartialCompositeKeyWithPagination', ['name~color', 1]);
            expect(JSON.parse(payload)).to.deep.equal(['annblack']);
        });

        it('should return a paginated list from partial composte key using the new iterator style', async function() {
            this.timeout(SHORT_STEP);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getStateByPartialCompositeKeyWithPaginationUsingAsyncIterator', ['name~color', 1]);
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

    describe('Split', () => {

        it('should split the composite key', async function () {
            this.timeout(MED_STEP);

            const payload = JSON.parse(await utils.query(suite, 'org.mynamespace.crud:splitCompositeKey', ['beth']));
            expect(payload.results.length).to.equal(3, 'Should return 3 composite key matching the name "beth"');

            expect(payload.key1.objectType).to.equal('name~color', '"objectType" value of the returned composite key should be "name~color"');
            expect(payload.key1.attributes.length).to.equal(2, '"attributes" value of the returned composite key should be array of size 2');
            expect(payload.key1.attributes[0]).to.equal('beth', '1st attribute value of the returned composite key should be "beth"');
            expect(payload.key1.attributes[1]).to.equal('black', '2nd attribute value of the returned composite key should be "black"');

            expect(payload.key2.objectType).to.equal('name~color', '"objectType" value of the returned composite key should be "name~color"');
            expect(payload.key2.attributes.length).to.equal(2, '"attributes" value of the returned composite key should be array of size 2');
            expect(payload.key2.attributes[0]).to.equal('beth', '1st attribute value of the returned composite key should be "beth"');
            expect(payload.key2.attributes[1]).to.equal('red', '2nd attribute value of the returned composite key should be "red"');


            expect(payload.key3.objectType).to.equal('name~color', '"objectType" value of the returned composite key should be "name~color"');
            expect(payload.key3.attributes.length).to.equal(2, '"attributes" value of the returned composite key should be array of size 2');
            expect(payload.key3.attributes[0]).to.equal('beth', '1st attribute value of the returned composite key should be "beth"');
            expect(payload.key3.attributes[1]).to.equal('yellow', '2nd attribute value of the returned composite key should be "yellow"');
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
