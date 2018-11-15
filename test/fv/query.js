'use scrict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const utils = require('./utils');
const {MED_INC, LONG_STEP} = utils.TIMEOUTS;


describe('Chaincode query', () => {
    const suite = 'query';
    before(async function() {
        this.timeout(LONG_STEP);
        // await utils.packPackages(suite);
        return utils.installAndInstantiate(suite);
    });

    after(async () => {
        // await utils.deletePackages(suite);
    });

    it('should perform an equals query', async function () {
        this.timeout(MED_INC);
        const query = JSON.stringify({
            selector: {
                value: 'value0'
            }
        });
        const payload = await utils.query(suite, 'org.mynamespace.query:query', [query]);
        expect(payload.result).to.deep.equal([JSON.stringify({value: 'value0'})]);
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
        expect(payload.result).to.deep.equal([
            JSON.stringify({value: 'value0'}),
            JSON.stringify({value: 'value1'}),
            JSON.stringify({value: 'value2'})
        ]);
    });
});
