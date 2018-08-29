'use strict';

const {Contract} = require('fabric-contract-api');

// Business logic (well just util but still it's general purpose logic)
const util = require('util');

/**
 * Support the Updating of values within the SmartContract
 */
class UpdateValues extends Contract {

	/**
	 * Sets a namespace so that the functions in this particular class can
	 * be separated from others.
	 */
	constructor() {
		super('org.mynamespace.updates');
		this.setUnknownFn(this.unknownFn);
	}

	/** The function to invoke if something unkown comes in.
	 *
	 */
	async uknownFn(ctx){
		throw new Error('Big Friendly letters ->>> DON\'T PANIC');
	}

	/**
	 * A function that will setup a starting value
	 * Note that this is not expliclity called from init.  IF you want it called from init, then
	 * specifiy it in the fn name when init is invoked.
	 */
	async setup({stub}){
		return stub.putState('dummyKey', Buffer.from('Starting Value'));
	}

	/**
	 *
	 * @param {int|string} newAssetValue new asset value to set
	 */
	async setNewAssetValue({stub},newAssetValue) {
		console.info(`Transaction ID: ${stub.getTxID()}`);
		console.info(`New Asset value will be ${newAssetValue}`);

		return stub.putState('dummyKey', Buffer.from(newAssetValue));
	}

	/**
	 * Doubles the api if it is a number fail otherwise

	 */
	async doubleAssetValue({stub}) {
		console.info(`Transaction ID: ${stub.getTxID()}`);

		let value = await stub.getState('dummyKey');
		if (isNaN(value)) {
			let str = `'Need to have numerc value set to double it, ${value}`;
			console.error(str);
			throw new Error(str);
		} else {
			let v = value*2;
			await stub.putState('dummyKey', v);
			return v;
		}
	}

}

module.exports = UpdateValues;
