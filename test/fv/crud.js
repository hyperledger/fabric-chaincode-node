'use scrict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const utils = require('./utils');
const {SHORT_INC, MED_INC, LONG_STEP} = utils.TIMEOUTS;

describe('Chaincode CRUD', () => {
    const suite = 'crud';
    before(async function() {
        this.timeout(LONG_STEP);
        // await utils.packPackages(suite);
        return utils.installAndInstantiate(suite);
    });

    after(async () => {
        // await utils.deletePackages(suite);
    });

    describe('GET', () => {

        it('should get single key value', async function () {
            this.timeout(SHORT_INC);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getKey', ['string']);
            expect(payload.result).to.equal('string');
        });

        it('should get a single key containing json data', async function() {
            this.timeout(SHORT_INC);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getKey', ['jsonkey1']);
            expect(JSON.parse(payload.result)).to.deep.equal({value: 'value1'});
        });

        it('should get a single composite key value', async function () {
            this.timeout(SHORT_INC);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getCompositeKey', ['ann', 'black']);
            expect(payload.result).to.equal('annblack');
        });

        it('should return a list of results from a partial composite key', async function() {
            this.timeout(SHORT_INC);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getPartialCompositeKey', ['ann']);
            expect(payload.result).to.deep.equal(['annblack', 'annred', 'annyellow']);
        });

        it('should return all keys between key1 and key3', async function() {
            this.timeout(SHORT_INC);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getKeysByRange', ['key1', 'key4']);
            expect(payload.result).to.deep.equal(['value1', 'value2', 'value3']);
        });

        it('should return a paginated list', async function() {
            this.timeout(SHORT_INC);
            const payload1 = await utils.query(suite, 'org.mynamespace.crud:getStateByRangeWithPagination', ['key1', 'key4', 2, 'key2']);
            expect(payload1.result).to.deep.equal(['value2', 'value3']);
            const payload2 = await utils.query(suite, 'org.mynamespace.crud:getStateByRangeWithPagination', ['key1', 'key4', 3, '']);
            expect(payload2.result).to.deep.equal(['value1', 'value2', 'value3']);
        });

        it('should return a state from a partial composite key', async function() {
            this.timeout(SHORT_INC);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getStateByPartialCompositeKey', ['name~color', 'ann']);
            expect(payload.result).to.deep.equal(['annblack', 'annred', 'annyellow']);
        });

        it('should return a paginated list from partial composte key', async function() {
            this.timeout(SHORT_INC);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getStateByPartialCompositeKeyWithPagination', ['name~color', 1]);
            expect(payload.result).to.deep.equal(['annblack']);
        });
    });

    describe('PUT', () => {
        it('should add a key', async function() {
            this.timeout(MED_INC);
            await utils.invoke(suite, 'org.mynamespace.crud:putKey', ['newKey1', 'newValue1']);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getKey', ['newKey1']);
            expect(payload.result).to.equal('newValue1');
        });

        it('should add a composite key', async function() {
            this.timeout(MED_INC);
            await utils.invoke(suite, 'org.mynamespace.crud:putCompositeKey', ['tim', 'green', 'newCompositeValue']);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getCompositeKey', ['tim', 'green']);
            expect(payload.result).to.equal('newCompositeValue');
        });

        it('should update an existing key', async function() {
            this.timeout(MED_INC);
            await utils.invoke(suite, 'org.mynamespace.crud:putKey', ['key1', 'updatedValue1']);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getKey', ['key1']);
            expect(payload.result).to.equal('updatedValue1');
        });
    });

    describe('DELETE', () => {
        it('should delete a key', async function() {
            this.timeout(MED_INC);
            await utils.invoke(suite, 'org.mynamespace.crud:deleteKey', ['key2']);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getKey', ['key2']);
            expect(payload.result).to.equal('');
        });

        it('should delete a composite key', async function() {
            this.timeout(MED_INC);
            await utils.invoke(suite, 'org.mynamespace.crud:deleteCompositeKey', ['tim', 'green']);
            const payload = await utils.query(suite, 'org.mynamespace.crud:getCompositeKey', ['tim', 'green']);
            expect(payload.result).to.equal('');
        });
    });
});
