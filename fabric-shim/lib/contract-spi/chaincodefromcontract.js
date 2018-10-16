/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const shim = require('../chaincode');
const Contract = require('fabric-contract-api').Contract;

const Logger = require('../logger');
const logger = Logger.getLogger('contracts-spi/chaincodefromcontract.js');

const ClientIdentity = require('../chaincode').ClientIdentity;
const SystemContract = require('./systemcontract');
/**
 * The user will have written a class than extends the 'Contract' interface; this
 * is expressed in terms of domain specific functions - that need to be called in the
 * lower-level 'invoke' and 'init' functions.
 *
 * This class impelements the 'invoke' and 'init' functions and does the 'routing'
 * @ignore
 **/
class ChaincodeFromContract {

	/**
     * Takes an array contract classes, and looks for the functions within those files.
     * Stores a reference to those, so they can be specifically called at a later time
     *
     * @param {Contract[]} contractClasses array of  contracts to register
     */
	constructor(contractClasses) {

		// the structure that stores the 'function-pointers', contents of the form
		// {  namespace : { ContractClass,  Contract,  functionNames[] }}
		this.contracts = {};

		if (!contractClasses){
			throw new Error('Missing argument: array of contract classes');
		}
		// always add in the 'meta' class that has general abilities
		contractClasses.push(SystemContract);
		logger.debug(contractClasses);


		for (let contractClass of contractClasses){

			let contract = new(contractClass);
			if (!(contract instanceof Contract)) {
				throw new Error(`invalid contract instance ${contract}`);
			}

			if (contract instanceof SystemContract){
				contract._setChaincode(this);
			}

			const propNames = Object.getOwnPropertyNames(Object.getPrototypeOf(contract));

			const functionNames = [];
			for (const propName of propNames) {
				const propValue = contract[propName];
				if (typeof propValue !== 'function') {
					continue;
				} else if (propName === 'constructor') {
					continue;
				} else if (propName.startsWith('_')){
					continue;
				}

				functionNames.push(propName);
			}
			let namespace = contract.getNamespace();
			logger.debug(functionNames,contractClass,namespace);

			this.contracts[`${namespace}`] = { contractClass, functionNames, contract };
		}

	}

	/**
     * The init fn is called for updated and init operations; the user though can include any function
     * in these calls. Therefore we are giving the user the responsibility to put the correct function in
     *
     * @param {ChaincodeStub} stub Stub class giving the full api
     */
	async Init(stub) {
		const fAndP = stub.getFunctionAndParameters();
		if (fAndP.fcn === '') {
			const message = 'Default initiator successful.';
			return shim.success(Buffer.from(message));
		} else{
			return this.invokeFunctionality(stub, fAndP);
		}
	}

	/**
     * The invoke fn is called for all the invoke operations
     *
     * @param {ChaincodeStub} stub Stub class giving the full api
     */
	async Invoke(stub) {
		const fAndP = stub.getFunctionAndParameters();
		return this.invokeFunctionality(stub, fAndP);
	}

	/**
     * The invokeFunctionality function is called for all the invoke operations; init is also redirected to here
     *
     * @param {ChaincodeStub} stub Stub class giving the full api
	 * @param {Object} fAndP Function and Paramters obtained from the smart contract argument
     */

	async invokeFunctionality(stub, fAndP) {
		try {
			let {namespace:ns,function:fn} = this._splitFunctionName(fAndP.fcn);

			if (!this.contracts[ns]){
				throw new Error(`Namespace is not known :${ns}:`);
			}

			let contractInstance = this.contracts[ns].contract;
			let ctx = contractInstance.createContext();
			ctx.setChaincodeStub(stub);
			ctx.setClientIdentity(new ClientIdentity(stub));

			const functionExists = this.contracts[ns].functionNames.indexOf(fn) !== -1;
			if (functionExists) {
				// before tx fn
				await contractInstance.beforeTransaction(ctx);

				// use the spread operator to make this pass the arguments seperately not as an array
				let result = await contractInstance[fn](ctx,...fAndP.params);

				// after tx fn
				await contractInstance.afterTransaction(ctx,result);

				if (Buffer.isBuffer(result)) {
					result = JSON.stringify([...result]);
				} else if (Array.isArray(result)) {
					result = JSON.stringify(result);
				} else {
					result = String(result);
				}

				result = Buffer.from(result);
				return shim.success(result);
			} else {
				await contractInstance.unknownTransaction(ctx);
			}
		} catch (error) {
			return shim.error(error);
		}
	}

	/**
	 * Parse the fcn name to be namespace and function.  These are separated by a :
	 * Anything after the : is treated as the function name
	 * No : implies that the whole string is a function name
	 *
	 * @param {String} fcn the combined function and name string
	 * @return {Object} split into namespace and string
	 */
	_splitFunctionName(fcn){
		// Did consider using a split(':') call to do this; however I chose regular expression for
		// the reason that it provides definitive description.
		// Split will just split - you would then need to write the code to handle edge cases
		// for no input, for multiple :, for multiple : without intervening characters
		// https://regex101.com/ is very useful for understanding

		const regex = /([^:]*)(?::|^)(.*)/g;
		let result = {namespace:'',function:''};

		let m = regex.exec(fcn);
		result.namespace = m[1];
		result.function = m[2];

		return result;
	}

	/**
	 * get information on the contracts
	 */
	getContracts(){
		let data = {};
		// this.contracts[`${namespace}`] = { contractClass, functionNames, contract };
		for (let c in this.contracts){
			data[c] = {'functions':this.contracts[c].functionNames};
		}

		return data;
	}

}

module.exports = ChaincodeFromContract;
