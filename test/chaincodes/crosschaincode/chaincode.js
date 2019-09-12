/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const {Contract} = require('fabric-contract-api');

class CrossChaincode extends Contract {

    constructor() {
        super('org.mynamespace.crosschaincode');
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

    async invokeChaincode({stub}) {
        const {params} = stub.getFunctionAndParameters();
        const results = await stub.invokeChaincode('crosschaincode2', [params[0], params[1]]);
        return results.payload.toString('utf8');
    }

    async invokeChaincodeError({stub}) {
        let error;
        const {params} = stub.getFunctionAndParameters();
        try {
            await stub.invokeChaincode('crosschaincode2', [params[0]]);
        } catch (err) {
            error = err;
        }
        return error.message;
    }

}
module.exports = CrossChaincode;