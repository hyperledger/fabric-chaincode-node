/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const test = require('../base.js');
const theModule = require('../../src');

test('module export tests', (t) => {
	t.equal(typeof theModule.start, 'function', 'should export top level Shim function');
	t.equal(typeof theModule.success, 'function', 'should export top level Shim function');
	t.equal(typeof theModule.error, 'function', 'should export top level Shim function');
	t.equal(typeof theModule.Shim, 'function', 'should export Shim class');
	t.equal(typeof theModule.Stub, 'function', 'should export Stub class');
	t.equal(typeof theModule.ChaincodeInterface, 'function', 'should export ChaincodeInterface class');
	t.equal(typeof theModule.ClientIdentity, 'function', 'should export ClientIdentity class');
	t.equal(typeof theModule.Iterators.HistoryQueryIterator, 'function', 'should export Iterators.HistoryQueryIterator class');
	t.equal(typeof theModule.HistoryQueryIterator, 'function', 'should export HistoryQueryIterator class');
	t.equal(typeof theModule.Iterators.StateQueryIterator, 'function', 'should export Iterators.StateQueryIterator class');
	t.equal(typeof theModule.StateQueryIterator, 'function', 'should export StateQueryIterator class');
	t.end();
});
