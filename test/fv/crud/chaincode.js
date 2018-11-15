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

    _log(args) {
        this.logBuffer.output.push(`::[UpdateValues] ${args}`);
    }

    async unknownTransaction({stub}) {
        throw new Error(`Could not find chaincode function: ${stub.getFunctionAndParameters().fnc}`);
    }

    async beforeTransaction(ctx) {
        this._log(`Transaction ID: ${ctx.stub.getTxID()}`);
    }

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
        return Buffer.from(JSON.stringify(this.logBuffer));
    }

    async getKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const key = params[0];
        const result = await stub.getState(key);
        this.logBuffer.result = result.toString();
        return Buffer.from(JSON.stringify(this.logBuffer));
    }

    async getCompositeKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const composite = stub.createCompositeKey('name~color', params);
        const result = await stub.getState(composite);
        this.logBuffer.result = result.toString();
        return Buffer.from(JSON.stringify(this.logBuffer));
    }

    async getPartialCompositeKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const result = await stub.getStateByPartialCompositeKey('name~color', params);
        this.logBuffer.result = (await getAllResults(result)).toString().split(',');
        return Buffer.from(JSON.stringify(this.logBuffer));
    }

    async getKeysByRange({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const result = await stub.getStateByRange(params[0], params[1]);
        this.logBuffer.result = (await getAllResults(result)).toString().split(',');
        return Buffer.from(JSON.stringify(this.logBuffer));
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
        this.logBuffer.result = (await getAllResults(iterator)).toString().split(',');
        return Buffer.from(JSON.stringify(this.logBuffer));
    }

    async getStateByPartialCompositeKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const iterator = await stub.getStateByPartialCompositeKey(params[0], params.slice(1));
        const result = await getAllResults(iterator);
        this.logBuffer.result = result;
        return Buffer.from(JSON.stringify(this.logBuffer));
    }

    async getStateByPartialCompositeKeyWithPagination({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const {iterator} = await stub.getStateByPartialCompositeKeyWithPagination(params[0], [], parseInt(params[1]), '');
        const result = await getAllResults(iterator);
        this.logBuffer.result = result;
        return Buffer.from(JSON.stringify(this.logBuffer));
    }

    async putKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        await stub.putState(...params);
        return Buffer.from(JSON.stringify(this.logBuffer));
    }

    async putCompositeKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const compositeKey = stub.createCompositeKey('name~color', [params[0], params[1]]);
        await stub.putState(compositeKey, params[2]);
        return Buffer.from(JSON.stringify(this.logBuffer));
    }
    async deleteKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        await stub.deleteState(params[0]);
        return Buffer.from(JSON.stringify(this.logBuffer));
    }

    async deleteCompositeKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const compositeKey = stub.createCompositeKey('name~color', params);
        await stub.deleteState(compositeKey);
        return Buffer.from(JSON.stringify(this.logBuffer));
    }
}


module.exports = CrudChaincode;
