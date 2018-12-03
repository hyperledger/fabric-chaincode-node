'use strict';

const {Contract} = require('fabric-contract-api');

async function getAllResults(iterator, getKeys) {
    const allResults = [];
    let loop = true;
    while (loop) {
        const res = await iterator.next();
        if (!res.value && res.done) {
            await iterator.close();
            return allResults;
        } else if (!res.value) {
            throw new Error('no value and not done (internal error?)');
        }
        const theVal = (getKeys) ? res.value.key : res.value.value.toString('utf8');
        allResults.push(theVal);
        if (res.done) {
            await iterator.close();
            loop = false;
            return allResults;
        }
    }
}

class CrudChaincode extends Contract {

    constructor() {
        super('org.mynamespace.crud');
        this.logBuffer = {output: []};
    }

    async instantiate(ctx) {
        const stub = ctx.stub;

        await stub.putState('string', Buffer.from('string'));
        const names = ['ann', 'beth', 'cory'];
        const colors = ['black', 'red', 'yellow'];
        for (const n in names) {
            for (const c in colors) {
                const compositeKey = stub.createCompositeKey('name~color', [names[n], colors[c]]);
                await stub.putState(compositeKey, names[n] + colors[c]);
            }
        }
        for (let i = 0; i < 5; i++) {
            await stub.putState(`key${i}`, Buffer.from(`value${i}`));
            await stub.putState(`jsonkey${i}`, Buffer.from(JSON.stringify({value: `value${i}`})));
        }
    }

    async getKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const key = params[0];
        return (await stub.getState(key)).toString();
    }

    async getCompositeKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const composite = stub.createCompositeKey('name~color', params);
        return (await stub.getState(composite)).toString();
    }

    async getPartialCompositeKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const result = await stub.getStateByPartialCompositeKey('name~color', params);
        return (await getAllResults(result)).toString().split(',');
    }

    async getKeysByRange({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const result = await stub.getStateByRange(params[0], params[1]);
        return (await getAllResults(result)).toString().split(',');
    }

    async getStateByRangeWithPagination({stub}) {
        let {params} = stub.getFunctionAndParameters();
        params = params.map((p) => {
            if (p === parseInt(p).toString()) {
                return parseInt(p);
            } else {
                return p;
            }
        });
        const {iterator} = await stub.getStateByRangeWithPagination(...params);
        return (await getAllResults(iterator)).toString().split(',');
    }

    async getStateByPartialCompositeKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const iterator = await stub.getStateByPartialCompositeKey(params[0], params.slice(1));
        return await getAllResults(iterator);
    }

    async getStateByPartialCompositeKeyWithPagination({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const {iterator} = await stub.getStateByPartialCompositeKeyWithPagination(params[0], [], parseInt(params[1]), '');
        return await getAllResults(iterator);
    }

    async putKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        await stub.putState(...params);
    }

    async putCompositeKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const compositeKey = stub.createCompositeKey('name~color', [params[0], params[1]]);
        await stub.putState(compositeKey, params[2]);
    }
    async deleteKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        await stub.deleteState(params[0]);
    }

    async deleteCompositeKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const compositeKey = stub.createCompositeKey('name~color', params);
        await stub.deleteState(compositeKey);
    }
}


module.exports = CrudChaincode;
