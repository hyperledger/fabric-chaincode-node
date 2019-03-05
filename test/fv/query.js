'use scrict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const utils = require('./utils');
const {SHORT_STEP, LONG_STEP} = utils.TIMEOUTS;


describe('Chaincode query', () => {
    const suite = 'query';
    before(async function() {
        this.timeout(LONG_STEP);
        // await utils.packPackages(suite);
        return utils.installAndInstantiate(suite, 'org.mynamespace.query:instantiate');
    });

    after(async () => {
        // await utils.deletePackages(suite);
    });

    it('should perform an equals query', async function () {
        this.timeout(LONG_STEP);
        const query = JSON.stringify({
            selector: {
                value: 'value0'
            }
        });
        let payload = await utils.query(suite, 'org.mynamespace.query:query', [query]);
        payload = payload.replace(/\\+"/g, '\\"');

        expect(JSON.parse(payload)).to.deep.equal([JSON.stringify({value: 'value0'})]);
    });

    it('should perform an regex query', async function () {
        this.timeout(SHORT_STEP);
        const query = JSON.stringify({
            selector: {
                value: {
                    $regex: 'value[0-2]'
                }
            }
        });
        let payload = await utils.query(suite, 'org.mynamespace.query:query', [query]);
        payload = payload.replace(/\\+"/g, '\\"');
        expect(JSON.parse(payload)).to.deep.equal([
            JSON.stringify({value: 'value0'}),
            JSON.stringify({value: 'value1'}),
            JSON.stringify({value: 'value2'})
        ]);
    });
});
