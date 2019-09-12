/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

const crypto = require('crypto');
const jsrsasign = require('jsrsasign');
const elliptic = require('elliptic');
const BN = require('bn.js');
const Signature = require('elliptic/lib/elliptic/ec/signature.js');
const ECDSAKey = require('./ecdsa-key.js');

const KEYUTIL = jsrsasign.KEYUTIL;
const EC = elliptic.ec;

const ENCRYPT_KEY = 'encrypt-key';
const INIT_VECTOR = 'iv';
const SIGN_KEY = 'sign-key';
const ALGORITHM = 'aes-256-cbc';

/**
 * Convenience library for performing encryption/decryption, and signing/signature verification
 * in chaincode.
 * @class
 */
class ChaincodeCryptoLibrary {
    /**
    * @param {ChaincodeStub} An instance of the ChaincodeStub class that got passed into the
    *   chaincode's Init() and Invoke() methods. For the library to function properly, the
    *   proposal request represented by the stub object must contain a transient map that
    *   has an <code>encrypt-key</code> if encryption/decryption is desired, and/or a
    *   <code>sign-key</code> if signing/signature verification is desired.
    */
    constructor(stub) {
        const tmap = stub.getTransient(); // string <-> byte[]
        const key = tmap.get(ENCRYPT_KEY);
        let iv = tmap.get(INIT_VECTOR); // optional

        if (!iv) {
            // transaction proposal did not include an IV, generate one
            iv = crypto.randomBytes(16);
        }

        if (key) {
            this.cipher = crypto.createCipheriv(ALGORITHM, key, iv);
            this.decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        }

        const signKey = tmap.get(SIGN_KEY);
        if (signKey) {
            this.signKey = importKey(signKey);
            this._ecdsa = new EC(elliptic.curves.p256);
        }
    }

    encrypt(plaintext) {
        if (this.cipher) {
            let ciphertext = this.cipher.update(plaintext, null, 'hex');
            ciphertext += this.cipher.final('hex');
            return Buffer.from(ciphertext, 'hex');
        } else {
            throw new Error('The transient map in the chaincode invocation request' +
    ' must contain an "encrypt-key" entry in order to use encryption');
        }
    }

    decrypt(ciphertext) {
        if (this.decipher) {
            let plaintext = this.decipher.update(ciphertext, null, 'utf8');
            plaintext += this.decipher.final('utf8');
            return Buffer.from(plaintext, 'utf8');
        } else {
            throw new Error('The transient map in the chaincode invocation request' +
    ' must contain an "encrypt-key" entry in order to use decryption');
        }
    }

    sign(message) {
        if (typeof this.signKey === 'undefined' || this.signKey === null) {
            throw new Error('The transient map in the chaincode invocation request' +
    ' must contain a "sign-key" entry in order to perform signing');
        }

        if (typeof message === 'undefined' || message === null) {
            throw new Error('A valid message is required to sign');
        }

        // Note that the statement below uses internal implementation specific to the
        // module './ecdsa/key.js'
        const signKey = this._ecdsa.keyFromPrivate(this.signKey._key.prvKeyHex, 'hex');
        let sig = this._ecdsa.sign(hash(message), signKey);
        sig = _preventMalleability(sig, this.signKey._key.ecparams);
        return sig.toDER();
    }

    verify(signature, message) {
        if (typeof this.signKey === 'undefined' || this.signKey === null) {
            throw new Error('The transient map in the chaincode invocation request' +
    ' must contain a "sign-key" entry in order to perform signature verification');
        }

        if (typeof signature === 'undefined' || signature === null) {
            throw new Error('A valid signature is required to verify');
        }

        if (typeof message === 'undefined' || message === null) {
            throw new Error('A valid message is required to verify');
        }

        if (!_checkMalleability(signature, this.signKey._key.ecparams)) {
            return {
                ok: false,
                error: new Error('Invalid S value in signature. Must be smaller than half of the order.')
            };
        }

        const pubKey = this._ecdsa.keyFromPublic(this.signKey.getPublicKey()._key.pubKeyHex, 'hex');
        // note that the signature is generated on the hash of the message, not the message itself
        const successful = pubKey.verify(hash(message), signature);
        return {
            ok: successful,
            error: successful ? null : new Error('Signature failed to verify')
        };
    }
}

function hash(message) {
    const hash1 = crypto.createHash('sha256');
    hash1.update(message);
    return hash1.digest('hex');
}

function importKey(raw) {
    // attempt to import the raw content, assuming it's one of the following:
    // X.509v1/v3 PEM certificate (RSA/DSA/ECC)
    // PKCS#8 PEM RSA/DSA/ECC public key
    // PKCS#5 plain PEM DSA/RSA private key
    // PKCS#8 plain PEM RSA/ECDSA private key
    // TODO: add support for the following passcode-protected PEM formats
    // - PKCS#5 encrypted PEM RSA/DSA private
    // - PKCS#8 encrypted PEM RSA/ECDSA private key
    let pemString = raw.toString();
    pemString = makeRealPem(pemString);
    let key = null;
    // let theKey = null;
    // let error = null;
    try {
        key = KEYUTIL.getKey(pemString);
    } catch (err) {
        throw new Error('Failed to parse key from PEM: ' + err);
    }

    if (key.type && key.type === 'EC') {
        return new ECDSAKey(key);
    } else {
        throw new Error('Does not understand PEM contents other than ECDSA private keys and certificates');
    }

}

// Utilitly method to make sure the start and end markers are correct
function makeRealPem(pem) {
    let result = null;
    if (typeof pem === 'string') {
        result = pem.replace(/-----BEGIN -----/, '-----BEGIN CERTIFICATE-----');
        result = result.replace(/-----END -----/, '-----END CERTIFICATE-----');
        result = result.replace(/-----([^-]+) ECDSA ([^-]+)-----([^-]*)-----([^-]+) ECDSA ([^-]+)-----/, '-----$1 EC $2-----$3-----$4 EC $5-----');
    }
    return result;
}

// [Angelo De Caro] ECDSA signatures do not have unique representation and this can facilitate
// replay attacks and more. In order to have a unique representation,
// this change-set forses BCCSP to generate and accept only signatures
// with low-S.
// Bitcoin has also addressed this issue with the following BIP:
// https://github.com/bitcoin/bips/blob/master/bip-0062.mediawiki
// Before merging this change-set, we need to ensure that client-sdks
// generates signatures properly in order to avoid massive rejection
// of transactions.

// map for easy lookup of the "N/2" value per elliptic curve
const halfOrdersForCurve = {
    'secp256r1': elliptic.curves.p256.n.shrn(1),
    'secp384r1': elliptic.curves.p384.n.shrn(1)
};

function _preventMalleability(sig, curveParams) {
    const curve = curveParams.name;
    const halfOrder = halfOrdersForCurve[curve];
    if (!halfOrder) {
        throw new Error(`Can not find the half order needed to calculate "s" value for immalleable signatures. Unsupported curve name: ${curve}`);
    }

    // in order to guarantee 's' falls in the lower range of the order, as explained in the above link,
    // first see if 's' is larger than half of the order, if so, it needs to be specially treated
    if (sig.s.cmp(halfOrder) === 1) { // module 'bn.js', file lib/bn.js, method cmp()
        // convert from BigInteger used by jsrsasign Key objects and bn.js used by elliptic Signature objects
        const bigNum = new BN(curveParams.n.toString(16), 16);
        sig.s = bigNum.sub(sig.s);
    }

    return sig;
}

function _checkMalleability(sig, curveParams) {
    const curve = curveParams.name;
    const halfOrder = halfOrdersForCurve[curve];
    if (!halfOrder) {
        throw new Error(`Can not find the half order needed to calculate "s" value for immalleable signatures. Unsupported curve name: ${curve}`);
    }

    // first need to unmarshall the signature bytes into the object with r and s values
    const sigObject = new Signature(sig, 'hex');
    if (!sigObject.r || !sigObject.s) {
        throw new Error('Failed to load the signature object from the bytes.');
    }

    // in order to guarantee 's' falls in the lower range of the order, as explained in the above link,
    // first see if 's' is larger than half of the order, if so, it is considered invalid in this context
    if (sigObject.s.cmp(halfOrder) === 1) { // module 'bn.js', file lib/bn.js, method cmp()
        return false;
    }

    return true;
}

module.exports = ChaincodeCryptoLibrary;
module.exports.ENCRYPT_KEY = ENCRYPT_KEY;
module.exports.INIT_VECTOR = INIT_VECTOR;
module.exports.SIGN_KEY = SIGN_KEY;
