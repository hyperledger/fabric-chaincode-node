/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const {Contract} = require('fabric-contract-api');

class EventsChaincode extends Contract {

    constructor() {
        super('org.mynamespace.events');
        this.logBuffer = {output: []};
    }

    async instantiate(ctx) {

    }

    async emit(ctx, value) {
        const buffer = Buffer.from(value);
        ctx.stub.setEvent('myevent', buffer);
    }

}
module.exports = EventsChaincode;
