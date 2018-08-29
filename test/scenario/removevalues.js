/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const {Contract} = require('fabric-contract-api');

/**
 * Set of functions to support modifing the values
 */
class RemoveValues extends Contract {

	/**
     *
     */
	constructor() {
		super('org.mynamespace.removes');
		// going to leave the default 'not known function' handling alone
	}

	/**
     *
     * @param {*} api
     */
	async quarterAssetValue({stub}) {
		console.info('Transaction ID: ' + stub.getTxID());

		let value = await stub.getState('dummyKey');
		if (isNan(value)) {
			let str = `'Need to have numerc value set to quarter it, ${value}`;
			console.error(str);
			throw new Error(str);
		} else {
			let v = value/4;
			await stub.putState('dummyKey', v);
			return v;
		}
	}


	async getAssetValue({stub}){
		console.info('Transaction ID: ' + stub.getTxID());

		let value = await stub.getState('dummyKey');

		return value;
	}

}

module.exports = RemoveValues;
