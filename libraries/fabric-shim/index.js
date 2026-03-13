/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

const shim = require('./lib/chaincode.js');
module.exports = shim;
module.exports.KeyEndorsementPolicy = shim.KeyEndorsementPolicy;
