/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const Contract = require('fabric-contract-api').Contract;
const Logger = require('../logger');
const logger = Logger.getLogger('contracts-spi/chaincodefromcontract.js');
const util = require('util');

/**
 * This is a contract that determines functions that can be invoked to provide general information
 *
 * @class
 * @memberof fabric-contract-api
 */
class SystemContract extends Contract {

    constructor() {
        super('org.hyperledger.fabric');
    }

    /**
	 *
	 * @param {Object} chaincode
	 */
    _setMetadata(metadata) {
        this.metadata = metadata;
        logger.info('Metadata is : \n', util.inspect(this.metadata, {depth:8}));
    }

    /**
     * Gets meta data associated with this Chaincode deployment
     */
    async GetMetadata() {
        return this.metadata;
    }

}

module.exports = SystemContract;
