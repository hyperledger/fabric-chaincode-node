/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

exports.command = 'metadata <subcommand>';
exports.desc = 'Command for handling metadata';
exports.builder = function (yargs) {
    // apply commands in subdirectories, throws an error if an incorrect command is entered
    return yargs.demandCommand(1, 'Incorrect command. Please see the list of commands above.')
        .commandDir('metadata');
};
exports.handler = function (argv) {};

module.exports.Generate = require('./metadata/lib/generate');

