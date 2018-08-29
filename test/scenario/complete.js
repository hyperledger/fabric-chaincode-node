/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

// SDK Library to asset with writing the logic
const {Contract} = require('fabric-contract-api');

/**
 * Set of functions to support modifing the values
 */
class CompleteAPI extends Contract {

	constructor(){

	}

	/// world state modification apis

	async keyHandling(ctx){
		let key = ctx.stub.createCompositieKey('prefix',['attr1','attr2']);
		console.log(`Composite Key is created as ${key}`);

		let parts = ctx.stub.splitCompositiveKey(key);
		console.log(`prefix is ${parts.prefix}`);
		console.log(`attributes are ${parts.attributes}`);
	}

}
