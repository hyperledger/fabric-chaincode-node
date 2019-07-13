/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

// This is the optimistic end-to-end flow that exercise the
// chaincode shim APIs under the controlled flow:
//
// install -> instantiate -> invoke -> query -> upgrade -> invoke -> query
//
// other error-inducing flows can be found in other files in this folder
'use strict';

const path = require('path');
const {shell: runcmds} = require('./../shell/cmd');

const testfvshim = async () => {
    const dir = path.join(__dirname, '../../test/fv');
    await runcmds([`npx mocha --recursive ${dir}`]);
};

exports.testfvshim = testfvshim;