/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

/* eslint-disable no-console*/
'use strict';

const util = require('util');
const execFile = util.promisify(require('child_process').execFile);

async function test_schema () {
    const options = {};
    const script = 'npm';
    const schemaTestCmd = 'run schema:test';
    const args = util.format(schemaTestCmd).split(' ');

    const {error, stdout, stderr} = await execFile(script, args, options);
    if (error) {
        throw error;
    } else {
        // validate the stdout/stderr
        console.log(stdout);
        console.log(stderr);
    }

}

exports.test_schema = test_schema;



