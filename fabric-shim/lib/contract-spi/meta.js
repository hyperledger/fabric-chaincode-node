/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const Contract = require('fabric-contract-api').Contract;

/**
 * This is a contract that determines functions that can be invoked to provide general information
 *
 * @class
 * @memberof fabric-contract-api
 */
class Meta extends Contract {

	constructor(){
		super('org.hyperledger.fabric');
	}

	/**
     * Gets meta data associated with this Chaincode deployment
     */
	getContractMetaData(){
		return Buffer.from(JSON.stringify(this.getMetadata()));
	}

}

module.exports = Meta;
