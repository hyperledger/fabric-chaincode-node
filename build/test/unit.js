/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

const {series} = require('gulp');
const {npm} = require('../shell/npm.js');

npm.useScript('compile');

async function typescript_check() {
    await npm.run.compile.prefix('fabric-contract-api').spawn();
    await npm.run.compile.prefix('fabric-shim').spawn();
}

async function unit_tests() {

    if (process.env.PIPELINE) {
        await npm.run.prefix('fabric-contract-api').test.ci.spawn();
        await npm.run.prefix('fabric-shim').test.ci.spawn();
        await npm.run.prefix('fabric-shim-crypto').test.ci.spawn();
    } else {
        await npm.run.prefix('fabric-contract-api').test.spawn();
        await npm.run.prefix('fabric-shim').test.spawn();
        await npm.run.prefix('fabric-shim-crypto').test.spawn();
    }
}

exports.unittest = series(typescript_check, unit_tests);
