/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const {Contract} = require('fabric-contract-api');
const ChaincodeCrypto = require('fabric-shim-crypto');

class EncryptionChaincode extends Contract {

    constructor() {
        super('org.mynamespace.encryption');
    }

    async instantiate(ctx) {
        const stub = ctx.stub;

        for (let i = 0; i < 3; i++) {
            await stub.putState(`key${i}`, Buffer.from(`value${i}`));
        }
    }

    async encryptValues({stub}) {
    // construct the encrypter, the stub is required to contain a transient map
        const encrypter = new ChaincodeCrypto(stub);
        const {params} = stub.getFunctionAndParameters();
        const ciphertext = encrypter.encrypt(Buffer.from(params[1])); // 2nd arg has the new value to encrypt
        await stub.putState(params[0], ciphertext); // 1st arg has the key
    }

    // tests the descryption of state values
    async decryptValues({stub}) {
        // construct the decrypter, the stub is required to contain a transient map
        const decrypter = new ChaincodeCrypto(stub);
        const {params} = stub.getFunctionAndParameters();
        const ciphertext = await stub.getState(params[0]);
        const value = decrypter.decrypt(ciphertext).toString();
        return value;
    }

    async signValues({stub}) {
        const signer = new ChaincodeCrypto(stub);
        const {params} = stub.getFunctionAndParameters();
        const signature = signer.sign(Buffer.from(params[1]));
        const state = {
            signature: signature,
            value: params[1]
        };

        await stub.putState(params[0], Buffer.from(JSON.stringify(state)));
    }

    async verifySignature({stub}) {
        const verifier = new ChaincodeCrypto(stub);
        const {params} = stub.getFunctionAndParameters();
        const stateRaw = await stub.getState(params[0]);
        const json = JSON.parse(stateRaw.toString());
        // signature is originally a buffer
        const sig = Buffer.from(json.signature);
        const result = verifier.verify(sig, json.value);
        return result;
    }

}
module.exports = EncryptionChaincode;