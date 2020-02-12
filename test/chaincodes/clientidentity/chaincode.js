/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const {Contract} = require('fabric-contract-api');
const shim = require('fabric-shim');

class ClientIdentityChaincode extends Contract {

    constructor() {
        super('org.mynamespace.clientidentity');
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

    async clientIdentityInstance({stub}) {
        const cid = new shim.ClientIdentity(stub);
        return {mspId: cid.mspId, id: cid.id};
    }

    async localMspID({stub}) {
        const localMspID = stub.getMspID();
        return {localMspID};
    }

}
module.exports = ClientIdentityChaincode;