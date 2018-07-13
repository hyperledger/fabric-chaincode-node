/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const os = require('os');
const path = require('path');

let tempdir = path.join(os.tmpdir(), 'fabric-shim');
let bnSamplesPath = path.join(__dirname, '../../fabric-samples/basic-network');
let bnTestDir = path.join(tempdir, 'basic-network');

module.exports.tempdir = tempdir;
module.exports.BasicNetworkSamplePath = bnSamplesPath;
module.exports.BasicNetworkTestDir = bnTestDir;