'use strict';

const { Contract } = require('fabric-contract-api');

const ScenarioContext = require('./scenariocontext');
/**
 * Support the Updating of values within the SmartContract
 */
class UpdateValues extends Contract {

	_log(args){
		this.logBuffer.output.push(`::[UpdateValues] ${args}`); //eslint-disable-line
	}
	/**
	 * Sets a namespace so that the functions in this particular class can
	 * be separated from others.
	 */
	constructor() {
		super('org.mynamespace.updates');
		this.logBuffer = { output: [] };
	}

	/** The function to invoke if something unkown comes in.
	 *
	 */
	async unknownTransaction(ctx){    //eslint-disable-line
		throw new Error('Big Friendly letters ->>> DON\'T PANIC');
	}

	async beforeTransaction(ctx){
		this._log(`Transaction ID: ${ctx.stub.getTxID()}`);   //eslint-disable-line
	}

	/**
	 * Custom context for use within this contract
	 */
	createContext(){
		return new ScenarioContext();
	}

	/**
	 * A function that will setup a starting value
	 * Note that this is not expliclity called from init.  IF you want it called from init, then
	 * specifiy it in the fn name when init is invoked.
	 */
	async setup(ctx){
		await ctx.stub.putState(ctx.generateKey(), Buffer.from('Starting Value'));

		this._log('Put state success');
		return Buffer.from(JSON.stringify(this.logBuffer));
	}

	/**
	 * @param {int|string} newAssetValue new asset value to set
	 */
	async setNewAssetValue(ctx,newAssetValue) {
		this._log(`New Asset value will be ${newAssetValue}`); //eslint-disable-line
		await ctx.stub.putState(ctx.generateKey(), Buffer.from(newAssetValue));

		return Buffer.from(JSON.stringify(this.logBuffer));
	}

	/**
	 * Doubles the api if it is a number fail otherwise
	 */
	async doubleAssetValue(ctx) {
		let value = await ctx.stub.getState(ctx.generateKey());
		if (isNaN(value)) {
			let str = `'Need to have numerc value set to double it, ${value}`;
			this._log(str);//eslint-disable-line
			throw new Error(str);
		} else {
			let v = value*2;
			await ctx.stub.putState(ctx.generateKey(), v);
			this.logBuffer.result=v;
		}
		return Buffer.from(JSON.stringify(this.logBuffer));
	}

}

module.exports = UpdateValues;
