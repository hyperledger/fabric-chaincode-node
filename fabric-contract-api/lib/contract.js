/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const Context = require('./context');

/**
 * The main Contact class that all code working within a Chaincode Container must be extending.
 *
 * Overriding of the `beforeTransaction` `afterTransaction` `unknownTransaction` and `createContext` are all optional
 * Supplying a namespace within the constructor is also option and will default to ''
 *
 * @memberof fabric-contract-api
 */
class Contract {

	/**
     * Constructor - supplying a namespace is recommended but is not mandatory.
	 *
     * @param {String} namespace namespace for the logic within this contract
     */
	constructor(namespace){
		if (namespace && namespace.trim() !== '' ){
			this.namespace = namespace.trim();
		} else {
			this.namespace = '';
		}
	}

	/**
	 * 'beforeTransaction' will be called before any of the transaction functions within your contract
	 * Override this method to implement your own processing. Examples of what you may wish to code
	 *  are Logging, Event Publishing or Permissions checks
	 *
	 * If an error is thrown, the whole transaction will be rejected
	 *
	 * @param {Context} ctx the transactional context
	 */
	async beforeTransaction(ctx){										// eslint-disable-line
		// default implementation is do nothing
	}

	/**
	 * 'afterTransaction' will be called before any of the transaction functions within your contract
	 * Override this method to implement your own processing. Examples of what you may wish to code
	 *  are Logging, Event Publishing
	 *
	 * If an error is thrown, the whole transaction will be rejected
	 *
	 * @param {Context} ctx the transactional context
	 * @param {Object} result value that is returned from the transaction function
	 */
	async afterTransaction(ctx,result){								// eslint-disable-line no-unused-vars
		// default implementation is do nothing
	}

	/**
	 * 'unknownTransaction' will be called if the required transaction function requested does not exist
	 * Override this method to implement your own processing.
	 * 	 *
	 * If an error is thrown, the whole transaction will be rejected
	 *
	 * @param {Context} ctx the transactional context
	 */
	async unknownTransaction(ctx) {
		const { fcn } = ctx.stub.getFunctionAndParameters();
		throw new Error(`You've asked to invoke a function that does not exist: ${fcn}`);
	}

	/**
	 * 'createContext' is called before any after, before, unknown or user defined transaction function. This permits contracts
	 * to use their own subclass of context to add additinal processing.
	 *
	 * After this function returns, the chaincodeStub and client identity objects will be injected.
	 * No chaincode apis are available for calling directly within this function. Nor should the constructor of the subclasses context assume
	 * any other setup.
	 *
	 * @return {Context} a context implementation that must subclass context
	 */
	createContext(){
		return new Context();
	}

	/**
     * @return {String} returns the namepsace
     */
	getNamespace(){
		return this.namespace;
	}

}

module.exports = Contract;
