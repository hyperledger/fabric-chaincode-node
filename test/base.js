/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const os = require('os');
const path = require('path');
const tape = require('tape');
const _test = require('tape-promise').default;
let test = _test(tape);

let tempdir = path.join(os.tmpdir(), 'fabric-shim');

test = ((context, f) => {
	return function() {
		arguments[0] = '\n\n******* ' + arguments[0] + ' *******\n';
		f.apply(context, arguments);
	};
})(this, test);

module.exports = test;
module.exports.tempdir = tempdir;