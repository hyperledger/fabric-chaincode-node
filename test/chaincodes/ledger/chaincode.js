/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const {Contract} = require('fabric-contract-api');
const {Ledger} = require('fabric-ledger');

class LedgerTestContract extends Contract {

    constructor() {
        super('org.example.ledger');
        this.logBuffer = {output: []};
    }

    async getLedger(ctx) {
        const ledger = Ledger.getLedger(ctx);

        return ledger?'success':'fail';
    }
}
module.exports = LedgerTestContract;
