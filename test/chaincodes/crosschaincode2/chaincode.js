/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const {Contract} = require('fabric-contract-api');

class CrossChaincode2 extends Contract {

    constructor() {
        super('org.mynamespace.crosschaincode2');
    }

    async instantiate(ctx) {
        const stub = ctx.stub;
        await stub.putState('key1', Buffer.from('crosschaincode2'));
    }

    // useful helper transactions
    async getKey({stub}) {
        const {params} = stub.getFunctionAndParameters();
        if (params.length !== 1) {
            throw new Error('Incorrect no. of parameters');
        }
        const key = params[0];
        return (await stub.getState(key)).toString();
    }

}
module.exports = CrossChaincode2;