/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';
/* eslint-disable no-console */
const {Contract} = require('fabric-contract-api');

/**
 * Set of functions to support modifing the values
 */
class RemoveValues extends Contract {

    constructor() {
        super('RemoveValues');
        // going to leave the default 'not known function' handling alone
    }

    /**
     *
     * @param {*} api
     */
    async quarterAssetValue({stub}) {
        console.info('Transaction ID: ' + stub.getTxID());

        const value = await stub.getState('dummyKey');
        if (Number.isNan(value)) {
            const str = `'Need to have numerc value set to quarter it, ${value}`;
            console.error(str);
            throw new Error(str);
        } else {
            const v = value / 4;
            await stub.putState('dummyKey', v);
            return v;
        }
    }


    async getAssetValue({stub}) {
        console.info('Transaction ID: ' + stub.getTxID());

        const value = await stub.getState('dummyKey');
        return value;
    }

}

module.exports = RemoveValues;
