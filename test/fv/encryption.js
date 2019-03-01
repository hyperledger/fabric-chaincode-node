/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const utils = require('./utils');
const {LONG_STEP} = utils.TIMEOUTS;

describe('Chaincode encryption', () => {
    const suite = 'encryption';

    before(async function () {
        this.timeout(LONG_STEP);

        return utils.installAndInstantiate(suite, 'org.mynamespace.encryption:instantiate');
    });

    it('should encrypt and decrypt state values', async function () {
        this.timeout(LONG_STEP);

        await utils.invoke(
            suite,
            'org.mynamespace.encryption:encryptValues',
            ['newkey', 'newvalue'],
            JSON.stringify({'encrypt-key':'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=', 'iv':'MDEyMzQ1Njc4OTAxMjM0NQ=='})
        );
        const payload = await utils.query(
            suite,
            'org.mynamespace.encryption:decryptValues',
            ['newkey', 'newvalue'],
            JSON.stringify({'encrypt-key':'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=', 'iv':'MDEyMzQ1Njc4OTAxMjM0NQ=='})
        );

        expect(payload).to.equal('newvalue', 'Test state value decryption with the ChaincodeCrypto library');
    });

    it('should sign a value and verify the signature', async function () {
        this.timeout(LONG_STEP);

        await utils.invoke(
            suite,
            'org.mynamespace.encryption:signValues',
            ['newkey1', 'newvalue1'],
            '{"sign-key":"LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tTUlHSEFnRUFNQk1HQnlxR1NNNDlB' +
            'Z0VHQ0NxR1NNNDlBd0VIQkcwd2F3SUJBUVFnWllNdmYzdzVWa3p6c1RRWUk4WjhJWHVHRlptbWZqSVg' +
            'yWVNTY3FDdkFraWhSQU5DQUFTNkJoRmdXL3EwUHpya3dUNVJsV1R0NDFWZ1hMZ3VQdjZRS3ZHc1c3U3' +
            'FLNlRrY0NmeHNXb1NqeTYvcjFTenpUTW5pM0o4aVFSb0ozcm9QbW94UExLNC0tLS0tRU5EIFBSSVZBV' +
            'EUgS0VZLS0tLS0="}'
        );
        const payload = await utils.query(suite,
            'org.mynamespace.encryption:verifySignature',
            ['newkey1', 'newvalue1'],
            '{"sign-key":"LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tTUlHSEFnRUFNQk1HQnlxR1NNNDlB' +
            'Z0VHQ0NxR1NNNDlBd0VIQkcwd2F3SUJBUVFnWllNdmYzdzVWa3p6c1RRWUk4WjhJWHVHRlptbWZqSVg' +
            'yWVNTY3FDdkFraWhSQU5DQUFTNkJoRmdXL3EwUHpya3dUNVJsV1R0NDFWZ1hMZ3VQdjZRS3ZHc1c3U3' +
            'FLNlRrY0NmeHNXb1NqeTYvcjFTenpUTW5pM0o4aVFSb0ozcm9QbW94UExLNC0tLS0tRU5EIFBSSVZBV' +
            'EUgS0VZLS0tLS0="}'
        );

        expect(JSON.parse(payload).ok).to.equal(true, 'Test signature verification with the ChaincodeCrypto Library');
    });

});