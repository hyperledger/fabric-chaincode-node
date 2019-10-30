/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
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
        allResults.push(JSON.parse(theVal));
        if (res.done) {
            await iterator.close();
            loop = false;
            return allResults;
        }
    }
}

class QueryChaincode extends Contract {

    async unknownTransaction({stub}) {
        throw new Error(`Could not find chaincode function: ${stub.getFunctionAndParameters()}`);
    }

    constructor() {
        super('org.mynamespace.query');
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
            await stub.putState(`jsonkey${i}`, Buffer.from(JSON.stringify({value: `value${i}`})));
        }
    }

    async query({stub}, query) {
        const iterator = await stub.getQueryResult(query);
        const results = await getAllResults(iterator);
        return JSON.stringify(results);
    }

}
module.exports = QueryChaincode;
