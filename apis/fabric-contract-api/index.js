/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

/**
 * This is the class that all contracts should extend. A Smart Contract will consist of one or more of these
 * @see {@link fabric-contract-api.Contract}
 */
module.exports.Contract = require('./lib/contract.js');
module.exports.Context = require('./lib/context.js');

Object.assign(module.exports, require('./lib/annotations'));

module.exports.JSONSerializer = require('./lib/jsontransactionserializer.js');
