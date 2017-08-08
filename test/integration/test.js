/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
const shim = require('fabric-shim');
const util = require('util');

var chaincode = class {
	Init(stub) {
		return Promise.resolve(shim.success());
	}

	Invoke(stub) {
		console.log('Transaction ID: ' + stub.getTxID());
		console.log(util.format('Args: %j', stub.getArgs()));

		return stub.getState('dummy')
			.then(() => {
				return shim.success();
			}, () => {
				return shim.error();
			});
	}
};

shim.start(new chaincode());