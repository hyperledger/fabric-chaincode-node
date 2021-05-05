/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const UpdateValues = require('./updatevalues');
const RemoveValues = require('./removevalues');

// export the smart contracts
module.exports.contracts = [UpdateValues, RemoveValues];
