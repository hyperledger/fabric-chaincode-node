/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

const test = require('../base.js');
const ShimCrypto = require('fabric-shim-crypto');
const testutil = require('./util.js');

test('Test encryption', (t) => {
	let stub = testutil.newStub();

	t.throws(
		() => {
			let sc = new ShimCrypto(stub);
			sc.encrypt('test');
		},
		/The transient map in the chaincode invocation request must contain an "encrypt-key" entry in order to use encryption/,
		'Test error checking for missing "encrypt-key" for encryption'
	);

	t.throws(
		() => {
			let sc = new ShimCrypto(stub);
			sc.decrypt('test');
		},
		/The transient map in the chaincode invocation request must contain an "encrypt-key" entry in order to use decryption/,
		'Test error checking for missing "encrypt-key" for decryption'
	);

	let tmap = {};
	tmap[ShimCrypto.ENCRYPT_KEY] = Buffer.from('01234567890123456789012345678901'); // 32-byte mock key
	tmap[ShimCrypto.INIT_VECTOR] = Buffer.from('0123456789012345'); // 128-bit IV (block size)

	stub = testutil.newStub(true, tmap);

	let sc = new ShimCrypto(stub);
	let ciphertext = sc.encrypt(Buffer.from('some text'));
	t.pass('Successfully encrypted plain text');

	let plaintext = sc.decrypt(ciphertext);
	t.equal(plaintext.toString(), 'some text', 'Successfully decrypted cipher text');

	t.end();
});

const TEST_KEY_PRIVATE_PEM = '-----BEGIN PRIVATE KEY-----' +
'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgZYMvf3w5VkzzsTQY' +
'I8Z8IXuGFZmmfjIX2YSScqCvAkihRANCAAS6BhFgW/q0PzrkwT5RlWTt41VgXLgu' +
'Pv6QKvGsW7SqK6TkcCfxsWoSjy6/r1SzzTMni3J8iQRoJ3roPmoxPLK4' +
'-----END PRIVATE KEY-----';

test('Test signing', (t) => {
	let stub = testutil.newStub();

	t.throws(
		() => {
			let sc = new ShimCrypto(stub);
			sc.sign('test');
		},
		/The transient map in the chaincode invocation request must contain a "sign-key" entry in order to perform signing/,
		'Test error checking for missing "sign-key" for signing'
	);

	t.throws(
		() => {
			let sc = new ShimCrypto(stub);
			sc.verify('dummySignature', 'test');
		},
		/The transient map in the chaincode invocation request must contain a "sign-key" entry in order to perform signature verification/,
		'Test error checking for missing "sign-key" for signature verification'
	);

	let tmap = {};
	tmap[ShimCrypto.SIGN_KEY] = Buffer.from(TEST_KEY_PRIVATE_PEM);

	stub = testutil.newStub(true, tmap);

	let sc = new ShimCrypto(stub);

	t.throws(
		() => {
			sc.sign();
		},
		/A valid message is required to sign/,
		'Test error checking for missing message to sign'
	);

	let signature = sc.sign('something');
	t.pass('Successfully signed message');

	t.throws(
		() => {
			sc.verify();
		},
		/A valid signature is required to verify/,
		'Test error checking for missing signature to verify'
	);

	t.throws(
		() => {
			sc.verify('dummySignature');
		},
		/A valid message is required to verify/,
		'Test error checking for missing message to verify'
	);

	let result = sc.verify(signature, 'wrong message');
	t.equal(result.ok, false, 'Test error condition of mismatched message');
	t.equal(result.error instanceof Error, true, 'Test error condition returning legit error object');
	t.equal(result.error.message, 'Signature failed to verify', 'Test error condition for failed signature verification');

	result = sc.verify(signature, 'something');
	t.equal(result.ok, true, 'Successfully verified signature with original message');

	t.end();
});