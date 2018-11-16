/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

/* eslint-disable no-console*/
'use strict';

const gulp = require('gulp');
const debug = require('gulp-debug');
const path = require('path');
const fs = require('fs');

const GOPATH = process.env.GOPATH;
if (!GOPATH || GOPATH === '') {
    console.error('The shim implementation depends on protobuf definitions from fabric GO package "%s", ' +
     'but the GOPATH environment variable has not been set up',
    'github.com/hyperledger/fabric/protos'
    );
    process.exit(1);
}

const baseDir = path.join(GOPATH, 'src/github.com/hyperledger/fabric/protos');
if (!fs.existsSync(baseDir)) {
    console.error(
        'The shim implementation depends on protobuf definitions from fabric GO package "%s", ' +
        'but the directory "%s" does not seem to exist',
        'github.com/hyperledger/fabric/protos',
        baseDir);
}

const DEPS = [
    path.join(baseDir, 'common/common.proto'),
    path.join(baseDir, 'common/policies.proto'),
    path.join(baseDir, 'msp/identities.proto'),
    path.join(baseDir, 'msp/msp_principal.proto'),
    path.join(baseDir, 'ledger/queryresult/kv_query_result.proto'),
    path.join(baseDir, 'peer/chaincode.proto'),
    path.join(baseDir, 'peer/chaincode_event.proto'),
    path.join(baseDir, 'peer/chaincode_shim.proto'),
    path.join(baseDir, 'peer/proposal.proto'),
    path.join(baseDir, 'peer/proposal_response.proto'),
    path.join(baseDir, 'token/transaction.proto'),
    path.join(baseDir, 'token/expectations.proto')
];

gulp.task('protos', function() {
    return gulp.src(DEPS, {base: baseDir})
        .pipe(debug())
        .pipe(gulp.dest(path.join(__dirname, '../fabric-shim/lib/protos')));
});

module.exports.DEPS = DEPS;
