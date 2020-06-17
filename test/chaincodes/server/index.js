/*
# Copyright Hitachi America, Ltd. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
"use strict";

const { Contract } = require('fabric-contract-api');

class ServerTestChaincode extends Contract {
    async unknownTransaction({stub}) {
        const {fcn, params} = stub.getFunctionAndParameters();
        throw new Error(`Could not find chaincode function: ${fcn}`);
    }

    constructor() {
        super('org.mynamespace.server');
    }

    async putValue(ctx, value) {
        await ctx.stub.putState('state1', Buffer.from(JSON.stringify(value)));
    }

    async getValue(ctx) {
        const value = await ctx.stub.getState('state1');
        return JSON.parse(value.toString());
    }
}

exports.contracts = [ ServerTestChaincode ];
