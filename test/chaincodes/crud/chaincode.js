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
        allResults.push(theVal);
        if (res.done) {
            await iterator.close();
            loop = false;
            return allResults;
        }
    }
}

async function getAllResultsUsingAsyncIterator(promiseOfIterator, getKeys) {
    const allResults = [];
    for await (const res of promiseOfIterator) {
        const theVal = (getKeys) ? res.key : res.value.toString('utf8');
        allResults.push(theVal);
    }

    // iterator will be automatically closed on exit from the loop
    // either by reaching the end, or a break or throw terminated the loop
    return allResults;
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
            await stub.putState(`jsonkey${i}`, Buffer.from(JSON.stringify({key: `k${i}`, value: `value${i}`})));
        }

        // add a large set of keys for testing pagination and larger data sets
        const DATA_SET_SIZE=229;
        for (let i = 0; i < DATA_SET_SIZE;i++){
            const compositeKey = stub.createCompositeKey('bulk-data',['bulk',i.toString().padStart(3,'0')]);
            await stub.putState(compositeKey, Buffer.from(i.toString().padStart(3,'0')));
        }
    }

    async getKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const key = params[0];
        return (await stub.getState(key)).toString();
    }

    async getKeysConcurrently({stub}) {
        const p1 = stub.getState('key1')
            .then((res) => {
                return res.toString('utf8');
            });

        const p2 = stub.getState('key2')
            .then((res) => {
                return res.toString('utf8');
            });

        const p3 = stub.getState('key3')
            .then((res) => {
                return res.toString('utf8');
            });

        return Promise.all([p1, p2, p3])
            .then((resArray) => {
                return resArray;
            });
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

    async getPartialCompositeKeyUsingAsyncIterator({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const promiseOfIterator = stub.getStateByPartialCompositeKey('name~color', params);
        return (await getAllResultsUsingAsyncIterator(promiseOfIterator)).toString().split(',');
    }

    async getKeysByRange({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const result = await stub.getStateByRange(params[0], params[1]);
        return (await getAllResults(result)).toString().split(',');
    }

    async getKeysByRangeUsingAsyncIterator({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const promiseOfIterator = stub.getStateByRange(params[0], params[1]);
        return (await getAllResultsUsingAsyncIterator(promiseOfIterator)).toString().split(',');
    }

    async getHistoryForKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const iterator = await stub.getHistoryForKey(params[0]);
        return (await getAllResults(iterator)).toString().split(',');
    }

    async getHistoryForKeyUsingAsyncIterator({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const promiseOfIterator = stub.getHistoryForKey(params[0]);
        return (await getAllResultsUsingAsyncIterator(promiseOfIterator)).toString().split(',');
    }

    async getQueryResultWithPagination({stub}) {
        const query = {
            selector: {
                key: {
                    $regex: 'k[0-4]'
                }
            }
        };

        let response = await stub.getQueryResultWithPagination(JSON.stringify(query), 2);
        const {iterator, metadata} = response;

        let results = await getAllResults(iterator, true /* get keys instead of values */);
        const results1 = results;
        const metadata1 = metadata;

        response = await stub.getQueryResultWithPagination(JSON.stringify(query), 1, metadata.bookmark);
        results = await getAllResults(response.iterator, true /* get keys instead of values */);
        const results2 = results;
        const metadata2 = response.metadata;
        return {results1, metadata1, results2, metadata2};
    }

    async getQueryResultWithPaginationUsingAsyncIterator({stub}) {
        const query = {
            selector: {
                key: {
                    $regex: 'k[0-4]'
                }
            }
        };

        let promiseOfIterator = stub.getQueryResultWithPagination(JSON.stringify(query), 2);
        let results = await getAllResultsUsingAsyncIterator(promiseOfIterator, true /* get keys instead of values */);
        const results1 = results;
        const metadata1 = (await promiseOfIterator).metadata;

        promiseOfIterator = stub.getQueryResultWithPagination(JSON.stringify(query), 1, metadata1.bookmark);
        results = await getAllResultsUsingAsyncIterator(promiseOfIterator, true /* get keys instead of values */);
        const results2 = results;
        const metadata2 = (await promiseOfIterator).metadata;
        return {results1, metadata1, results2, metadata2};
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

    async getStateByRangeWithPaginationUsingAsyncIterator({stub}) {
        let {params} = stub.getFunctionAndParameters();
        params = params.map((p) => {
            if (p === parseInt(p).toString()) {
                return parseInt(p);
            } else {
                return p;
            }
        });
        const promiseOfIterator = stub.getStateByRangeWithPagination(...params);
        return (await getAllResultsUsingAsyncIterator(promiseOfIterator)).toString().split(',');
    }

    async getStateByPartialCompositeKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const iterator = await stub.getStateByPartialCompositeKey(params[0], params.slice(1));
        return await getAllResults(iterator);
    }

    async getStateByPartialCompositeKeyUsingAsyncIterator({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const promiseOfIterator =  stub.getStateByPartialCompositeKey(params[0], params.slice(1));
        return await getAllResultsUsingAsyncIterator(promiseOfIterator);
    }

    async getStateByPartialCompositeKeyWithPagination({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const {iterator} = await stub.getStateByPartialCompositeKeyWithPagination(params[0], [], parseInt(params[1]), '');
        return await getAllResults(iterator);
    }

    async getStateByPartialCompositeKeyWithPaginationUsingAsyncIterator({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const promiseOfIterator = stub.getStateByPartialCompositeKeyWithPagination(params[0], [], parseInt(params[1]), '');
        return await getAllResultsUsingAsyncIterator(promiseOfIterator);
    }

    /*
    * This chaincode is to be implemented when the new basic network has been created,
    * as key level endorsement is not enabled with this current basic_network
    */

    // async getStateValidationParameter({stub}) {
    //     const {params} = stub.getFunctionAndParameters();
    //     // should exists validation parameter ['Org1MSP'] for key1
    //     const epBuffer = await stub.getStateValidationParameter(params[0]);
    //     const ep = new KeyEndorsementPolicy(epBuffer);

    //     // should not exists validation parameter for key2
    //     const epBuffer2 = await stub.getStateValidationParameter(params[1]);
    //     return {ep, epBuffer2};
    // }

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

    /*
    * This chaincode is to be implemented when the new basic network has been created,
    * as key level endorsement is not enabled with this current basic_network
    */

    // async setStateValidationParameter({stub}) {
    //     const {params} = stub.getFunctionAndParameters();
    //     const ep = new KeyEndorsementPolicy();
    //     ep.addOrgs('MEMBER', 'Org1MSP');
    //     await stub.setStateValidationParameter(params[0], ep.getPolicy());
    // }

    async splitCompositeKey({stub}) {
        const {params} = stub.getFunctionAndParameters();

        const iterator = await stub.getStateByPartialCompositeKey('name~color', [params[0]]);
        const results = await getAllResults(iterator, true /* get keys instead of values */);

        const key1 = stub.splitCompositeKey(results[0]);
        const key2 = stub.splitCompositeKey(results[1]);
        const key3 = stub.splitCompositeKey(results[2]);
        return {results, key1, key2, key3};
    }

}
module.exports = CrudChaincode;
