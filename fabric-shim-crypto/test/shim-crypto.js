/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
/* global describe it beforeEach afterEach after */

const chai = require('chai');
const expect = chai.expect;
const rewire = require('rewire');
const sinon = require('sinon');

const ShimCrypto = rewire('../../fabric-shim-crypto/lib/enc-sign.js');
const crypto = ShimCrypto.__get__('crypto');
const ENCRYPT_KEY = ShimCrypto.__get__('ENCRYPT_KEY');
const INIT_VECTOR = ShimCrypto.__get__('INIT_VECTOR');
const SIGN_KEY = ShimCrypto.__get__('SIGN_KEY');
const ALGORITHM = ShimCrypto.__get__('ALGORITHM');
const ECDSAKey = ShimCrypto.__get__('ECDSAKey');

const mapItems = {};
mapItems.iv = {
    key: INIT_VECTOR,
    value: {
        toBuffer: () => {
            return Buffer.from('0123456789012345');
        }
    }
};

mapItems.encryptKey = {
    key: ENCRYPT_KEY,
    value: {
        toBuffer: () => {
            return Buffer.from('01234567890123456789012345678901');
        }
    }
};

mapItems.signKey = {
    key: SIGN_KEY,
    value: {
        toBuffer: () => {
            return Buffer.from('some signKey');
        }
    }
};

const saveImportKey = ShimCrypto.__get__('importKey');
const saveEC = ShimCrypto.__get__('EC');
const elliptic = ShimCrypto.__get__('elliptic');

let mockImportKey;
let ecStubInstance;
let mockEC;

let mockVerifyStub;
describe('enc-sign', () => {
    describe('ChaincodeCryptoLibrary', () => {
        const sandbox = sinon.createSandbox();

        afterEach(() => {
            sandbox.restore();
        });

        it ('should set no variables', () => {
            const sc = newShimCrypto();

            expect(sc.cipher).to.be.undefined;
            expect(sc.decipher).to.be.undefined;
            expect(sc.signKey).to.be.undefined;
            expect(sc._ecdsa).to.be.undefined;
        });

        it ('should set key values when init vector in map', () => {
            const mockCreateCipher = sandbox.stub(crypto, 'createCipheriv').returns('some cipher');
            const mockCreateDecipher = sandbox.stub(crypto, 'createDecipheriv').returns('some decipher');

            const sc = newShimCrypto(['iv', 'encryptKey']);

            expect(sc.cipher).to.deep.equal('some cipher');
            expect(sc.decipher).to.deep.equal('some decipher');
            expect(sc.signKey).to.be.undefined;
            expect(sc._ecdsa).to.be.undefined;

            expect(mockCreateCipher.calledOnce).to.be.ok;
            expect(mockCreateCipher.firstCall.args).to.deep.equal([ALGORITHM, mapItems.encryptKey.value.toBuffer(), mapItems.iv.value.toBuffer()]);
            expect(mockCreateDecipher.calledOnce).to.be.ok;
            expect(mockCreateDecipher.firstCall.args).to.deep.equal([ALGORITHM, mapItems.encryptKey.value.toBuffer(), mapItems.iv.value.toBuffer()]);
        });

        it ('should set key values when init vector not in map', () => {

            const mockRandomBytes = sandbox.stub(crypto, 'randomBytes').returns('some random bytes');
            const mockCreateCipher = sandbox.stub(crypto, 'createCipheriv').returns('some cipher');
            const mockCreateDecipher = sandbox.stub(crypto, 'createDecipheriv').returns('some decipher');

            const sc = newShimCrypto(['encryptKey']);

            expect(sc.cipher).to.deep.equal('some cipher');
            expect(sc.decipher).to.deep.equal('some decipher');
            expect(sc.signKey).to.be.undefined;
            expect(sc._ecdsa).to.be.undefined;

            expect(mockRandomBytes.calledOnce).to.be.ok;
            expect(mockRandomBytes.firstCall.args).to.deep.equal([16]);
            expect(mockCreateCipher.calledOnce).to.be.ok;
            expect(mockCreateCipher.firstCall.args).to.deep.equal([ALGORITHM, mapItems.encryptKey.value.toBuffer(), 'some random bytes']);
            expect(mockCreateDecipher.calledOnce).to.be.ok;
            expect(mockCreateDecipher.firstCall.args).to.deep.equal([ALGORITHM, mapItems.encryptKey.value.toBuffer(), 'some random bytes']);
        });

        it ('should set sign key values', () => {
            mockForSignKey();

            const sc = newShimCrypto(['signKey']);

            expect(sc.cipher).to.be.undefined;
            expect(sc.decipher).to.be.undefined;
            expect(sc.signKey).to.deep.equal('some imported signKey');
            expect(sc._ecdsa).to.deep.equal(ecStubInstance);

            expect(mockImportKey.calledOnce).to.be.ok;
            expect(mockImportKey.firstCall.args).to.deep.equal([mapItems.signKey.value.toBuffer()]);
            expect(mockEC.calledOnce).to.be.ok;
            expect(mockEC.firstCall.args).to.deep.equal([elliptic.curves.p256]);

            clearSignKeyMocks();
        });

        describe('encrypt', () => {
            it ('should throw an error if cipher not set', () => {
                const sc = newShimCrypto();

                expect(() => {
                    sc.encrypt();
                }).to.throw(/The transient map in the chaincode invocation request must contain an "encrypt-key" entry in order to use encryption/);
            });

            it ('should return a buffer of encrypted plaintext', () => {
                const updateStub = sinon.stub().returns('0000000000');
                const finalStub = sinon.stub().returns('1111111111');

                sandbox.stub(crypto, 'createCipheriv').returns({
                    update: updateStub,
                    final: finalStub
                });

                const sc = newShimCrypto(['encryptKey']);
                expect(sc.encrypt('some message').toString('hex')).to.deep.equal('00000000001111111111');
                expect(updateStub.calledOnce).to.be.ok;
                expect(updateStub.firstCall.args).to.deep.equal(['some message', null, 'hex']);
                expect(finalStub.calledOnce).to.be.ok;
                expect(finalStub.firstCall.args).to.deep.equal(['hex']);
            });
        });

        describe('decrypt', () => {
            it ('should throw an error if cipher not set', () => {
                const sc = newShimCrypto();

                expect(() => {
                    sc.decrypt();
                }).to.throw(/The transient map in the chaincode invocation request must contain an "encrypt-key" entry in order to use decryption/);
            });

            it ('should return a buffer of decrypted ciphertext', () => {
                const updateStub = sinon.stub().returns('some ');
                const finalStub = sinon.stub().returns('message');
                // eslint-disable-next-line no-unused-vars
                // const mockCreateDeipher =
                sandbox.stub(crypto, 'createDecipheriv').returns({
                    update: updateStub,
                    final: finalStub
                });

                const sc = newShimCrypto(['encryptKey']);
                expect(sc.decrypt('00000000001111111111').toString('utf8')).to.deep.equal('some message');
                expect(updateStub.calledOnce).to.be.ok;
                expect(updateStub.firstCall.args).to.deep.equal(['00000000001111111111', null, 'utf8']);
                expect(finalStub.calledOnce).to.be.ok;
                expect(finalStub.firstCall.args).to.deep.equal(['utf8']);
            });

            it ('should be able to decrypt an encrypted value', () => {
                const sc = newShimCrypto(['encryptKey']);
                const ciphertext = sc.encrypt('some message');
                expect(sc.decrypt(ciphertext).toString('utf8')).to.deep.equal('some message');
            });
        });

        describe('sign', () => {
            beforeEach(() => {
                mockForSignKey();
            });

            afterEach(() => {
                clearSignKeyMocks();
            });

            it ('should throw an error when signKey not set', () => {
                const sc = newShimCrypto();

                expect(() => {
                    sc.sign();
                }).to.throw(/The transient map in the chaincode invocation request must contain a "sign-key" entry in order to perform signing/);
            });

            it ('should throw an error if signKey is null', () => {
                const sc = newShimCrypto();
                sc.signKey = null;

                expect(() => {
                    sc.sign();
                }).to.throw(/The transient map in the chaincode invocation request must contain a "sign-key" entry in order to perform signing/);
            });

            it ('should throw an error if the message is not passed', () => {
                const sc = newShimCrypto(['signKey']);

                expect(() => {
                    sc.sign();
                }).to.throw(/A valid message is required to sign/);
            });

            it ('should throw an error if the message is null', () => {
                const sc = newShimCrypto(['signKey']);

                expect(() => {
                    sc.sign(null);
                }).to.throw(/A valid message is required to sign/);
            });

            it ('should sign the message', () => {
                const savePreventMalleability = ShimCrypto.__get__('_preventMalleability');
                const saveHash = ShimCrypto.__get__('hash');

                const _preventMalleabilityStub = sinon.stub().returns({
                    toDER: sinon.stub().returns('some DER')
                });
                ShimCrypto.__set__('_preventMalleability', _preventMalleabilityStub);

                const hashStub = sinon.stub().returns('some hash');
                ShimCrypto.__set__('hash', hashStub);

                mockImportKey = sinon.stub().returns({
                    _key: {
                        prvKeyHex: 'some prvKeyHex',
                        ecparams: 'some params'
                    }
                });
                ShimCrypto.__set__('importKey', mockImportKey);

                const sc = newShimCrypto(['signKey']);

                expect(sc.sign('some message')).to.deep.equal('some DER');
                expect(ecStubInstance.keyFromPrivate.calledOnce).to.be.ok;
                expect(ecStubInstance.keyFromPrivate.firstCall.args).to.deep.equal(['some prvKeyHex', 'hex']);
                expect(hashStub.calledOnce).to.be.ok;
                expect(hashStub.firstCall.args).to.deep.equal(['some message']);
                expect(ecStubInstance.sign.calledOnce).to.be.ok;
                expect(ecStubInstance.sign.firstCall.args).to.deep.equal(['some hash', 'some key from private']);
                expect(_preventMalleabilityStub.calledOnce).to.be.ok;
                expect(_preventMalleabilityStub.firstCall.args).to.deep.equal(['some signed message', 'some params']);

                ShimCrypto.__set__('_preventMalleability', savePreventMalleability);
                ShimCrypto.__set__('hash', saveHash);
            });
        });

        describe('verify', () => {
            beforeEach(() => {
                mockForSignKey();

                mockImportKey = sinon.stub().returns({
                    getPublicKey: () => {
                        return {
                            _key: {
                                pubKeyHex: 'some pubKeyHex'
                            }
                        };
                    },
                    _key: {
                        ecparams: 'some params'
                    }
                });
            });

            afterEach(() => {
                clearSignKeyMocks();
            });

            it ('should throw an error when signKey not set', () => {
                const sc = newShimCrypto();

                expect(() => {
                    sc.verify();
                }).to.throw(/The transient map in the chaincode invocation request must contain a "sign-key" entry in order to perform signature verification/);
            });

            it ('should throw an error if signKey is null', () => {
                const sc = newShimCrypto();
                sc.signKey = null;

                expect(() => {
                    sc.verify();
                }).to.throw(/The transient map in the chaincode invocation request must contain a "sign-key" entry in order to perform signature verification/);
            });

            it ('should throw an error if the signature is not passed', () => {
                const sc = newShimCrypto(['signKey']);

                expect(() => {
                    sc.verify();
                }).to.throw(/A valid signature is required to verify/);
            });

            it ('should throw an error if the signature is null', () => {
                const sc = newShimCrypto(['signKey']);

                expect(() => {
                    sc.verify(null);
                }).to.throw(/A valid signature is required to verify/);
            });

            it ('should throw an error if the message is not passed', () => {
                const sc = newShimCrypto(['signKey']);

                expect(() => {
                    sc.verify('some sig');
                }).to.throw(/A valid message is required to verify/);
            });

            it ('should throw an error if the message is null', () => {
                const sc = newShimCrypto(['signKey']);

                expect(() => {
                    sc.verify('some sig', null);
                }).to.throw(/A valid message is required to verify/);
            });

            it ('should return an error if not malleable', () => {
                const saveCheckMalleability = ShimCrypto.__get__('_checkMalleability');

                const _checkMalleabilityStub = sinon.stub().returns(false);
                ShimCrypto.__set__('_checkMalleability', _checkMalleabilityStub);

                ShimCrypto.__set__('importKey', mockImportKey);

                const sc = newShimCrypto(['signKey']);

                const result = sc.verify('some sig', 'some message');

                expect(result.ok).to.deep.equal(false);
                expect(result.error instanceof Error).to.be.ok;
                expect(result.error.message).to.deep.equal('Invalid S value in signature. Must be smaller than half of the order.');
                expect(_checkMalleabilityStub.calledOnce).to.be.ok;
                expect(_checkMalleabilityStub.firstCall.args).to.deep.equal(['some sig', 'some params']);

                ShimCrypto.__set__('_checkMalleability', saveCheckMalleability);
            });

            it ('should return ok true for verfied signed message', () => {
                const saveCheckMalleability = ShimCrypto.__get__('_checkMalleability');
                const saveHash = ShimCrypto.__get__('hash');

                const _checkMalleabilityStub = sinon.stub().returns(true);
                ShimCrypto.__set__('_checkMalleability', _checkMalleabilityStub);

                const hashStub = sinon.stub().returns('some hash');
                ShimCrypto.__set__('hash', hashStub);

                ShimCrypto.__set__('importKey', mockImportKey);

                const sc = newShimCrypto(['signKey']);

                const result = sc.verify('some sig', 'some message');

                expect(result.ok).to.deep.equal(true);
                expect(result.error).to.deep.equal(null);
                expect(_checkMalleabilityStub.calledOnce).to.be.ok;
                expect(_checkMalleabilityStub.firstCall.args).to.deep.equal(['some sig', 'some params']);
                expect(ecStubInstance.keyFromPublic.calledOnce).to.be.ok;
                expect(ecStubInstance.keyFromPublic.firstCall.args).to.deep.equal(['some pubKeyHex', 'hex']);
                expect(mockVerifyStub.calledOnce).to.be.ok;
                expect(mockVerifyStub.firstCall.args).to.deep.equal(['some hash', 'some sig']);

                ShimCrypto.__set__('_checkMalleability', saveCheckMalleability);
                ShimCrypto.__set__('hash', saveHash);
            });

            it ('should return ok false and an error unverified signed message', () => {
                const saveCheckMalleability = ShimCrypto.__get__('_checkMalleability');
                const saveHash = ShimCrypto.__get__('hash');

                const _checkMalleabilityStub = sinon.stub().returns(true);
                ShimCrypto.__set__('_checkMalleability', _checkMalleabilityStub);

                const hashStub = sinon.stub().returns('some hash');
                ShimCrypto.__set__('hash', hashStub);

                ShimCrypto.__set__('importKey', mockImportKey);

                mockVerifyStub = sinon.stub().returns(false);
                ecStubInstance.keyFromPublic = sinon.stub().returns({
                    verify: mockVerifyStub
                });
                mockEC = sinon.spy(() => {
                    return ecStubInstance;
                });
                ShimCrypto.__set__('EC', mockEC);

                const sc = newShimCrypto(['signKey']);

                const result = sc.verify('some sig', 'some message');

                expect(result.ok).to.deep.equal(false);
                expect(result.error instanceof Error).to.be.ok;
                expect(result.error.message).to.deep.equal('Signature failed to verify');
                expect(_checkMalleabilityStub.calledOnce).to.be.ok;
                expect(_checkMalleabilityStub.firstCall.args).to.deep.equal(['some sig', 'some params']);
                expect(ecStubInstance.keyFromPublic.calledOnce).to.be.ok;
                expect(ecStubInstance.keyFromPublic.firstCall.args).to.deep.equal(['some pubKeyHex', 'hex']);
                expect(mockVerifyStub.calledOnce).to.be.ok;
                expect(mockVerifyStub.firstCall.args).to.deep.equal(['some hash', 'some sig']);

                ShimCrypto.__set__('_checkMalleability', saveCheckMalleability);
                ShimCrypto.__set__('hash', saveHash);
            });
        });
    });

    describe('hash', () => {
        it ('should hash a message', () => {
            const updateStub = sinon.stub();
            const digestStub = sinon.stub().returns('some digest');

            const createHashStub = sinon.stub(crypto, 'createHash').returns({
                update: updateStub,
                digest: digestStub
            });

            const result = ShimCrypto.__get__('hash')('some message');

            expect(result).to.deep.equal('some digest');
            expect(createHashStub.calledOnce).to.be.ok;
            expect(createHashStub.firstCall.args).to.deep.equal(['sha256']);
            expect(updateStub.calledOnce).to.be.ok;
            expect(updateStub.firstCall.args).to.deep.equal(['some message']);
            expect(digestStub.calledOnce).to.be.ok;
            expect(digestStub.firstCall.args).to.deep.equal(['hex']);

            createHashStub.restore();
        });
    });

    describe('importKey', () => {
        const importKey = ShimCrypto.__get__('importKey');

        const KEYUTIL = ShimCrypto.__get__('KEYUTIL');
        const saveMakeRealPem = ShimCrypto.__get__('makeRealPem');

        let makeRealPemStub;

        beforeEach(() => {
            makeRealPemStub = sinon.stub().returns('some pem string');
            ShimCrypto.__set__('makeRealPem', makeRealPemStub);
        });

        after(() => {
            ShimCrypto.__set__('makeRealPem', saveMakeRealPem);
        });

        it ('should throw an error if unable to parse PEM string', () => {
            const getKeyStub = sinon.stub(KEYUTIL, 'getKey').throws('some error');

            expect(() => {
                importKey('some raw content');
            }).to.throw(/Failed to parse key from PEM/);

            getKeyStub.restore();
        });

        it ('should throw an error if key does not have type', () => {
            const getKeyStub = sinon.stub(KEYUTIL, 'getKey').returns('some key');

            expect(() => {
                importKey('some raw content');
            }).to.throw(/Does not understand PEM contents other than ECDSA private keys and certificates/);

            getKeyStub.restore();
        });

        it ('should throw an error if key type not EC', () => {
            const getKeyStub = sinon.stub(KEYUTIL, 'getKey').returns({
                type: 'some type'
            });

            expect(() => {
                importKey('some raw content');
            }).to.throw(/Does not understand PEM contents other than ECDSA private keys and certificates/);

            getKeyStub.restore();
        });

        it ('should return a new ECDSAKey', () => {
            const mockECDSAKey = sinon.spy(() => {
                return sinon.createStubInstance(ECDSAKey);
            });
            ShimCrypto.__set__('ECDSAKey', mockECDSAKey);

            const mockKey = {
                type: 'EC'
            };

            sinon.stub(KEYUTIL, 'getKey').returns(mockKey);

            expect(importKey('some raw content') instanceof ECDSAKey).to.be.ok;
            expect(mockECDSAKey.calledWithNew).to.be.ok;
            expect(mockECDSAKey.firstCall.args).to.deep.equal([mockKey]);

            ShimCrypto.__set__('ECDSAKey', ECDSAKey);
        });
    });

    describe('makeRealPem', () => {
        const makeRealPem = ShimCrypto.__get__('makeRealPem');

        it ('should return null if pem not string', () => {
            expect(makeRealPem(12)).to.deep.equal(null);
        });

        it ('should make a real PEM', () => {
            const myCert = `-----BEGIN -----
-----BEGIN ECDSA CERT-----
MIIB4TCCAWcCCQDNvJ6OSzyk+jAKBggqhkjOPQQDAjBaMQswCQYDVQQGEwJnYjEM
MAoGA1UECAwDaWJtMQwwCgYDVQQHDANpYm0xDDAKBgNVBAoMA2libTETMBEGA1UE
CwwKYmxvY2tjaGFpbjEMMAoGA1UEAwwDaWJtMB4XDTE4MDcxMjE0MjAyOVoXDTI4
MDcwOTE0MjAyOVowWjELMAkGA1UEBhMCZ2IxDDAKBgNVBAgMA2libTEMMAoGA1UE
BwwDaWJtMQwwCgYDVQQKDANpYm0xEzARBgNVBAsMCmJsb2NrY2hhaW4xDDAKBgNV
BAMMA2libTB2MBAGByqGSM49AgEGBSuBBAAiA2IABBZMuR7DBRGF7iBaTn4yD368
0gNNUcI/ktPo2j1gv+ief6hGHH+s0qGwB5sZlCAGgmmzextA95F2H5HJAG5AsfE8
MTs+ZN+eq1jh5KQhGuPYVNF6rckW1iuMpc8+bKwQJTAKBggqhkjOPQQDAgNoADBl
AjAcqFjc35SgU8BXrdPB9ZuHqrrGemXiO54CswaWXxriD8tKcDmMCPSpdELmVwmw
ND8CMQDPdGalkIdXkkxLcuHfuTWEuAsYusWAxEiEF2w5Snq0Cu/E1jPeVZBES/9N
i6dOfok=
----- END ECDSA CERT -----
-----END -----`;

            const myChangedCert = `-----BEGIN CERTIFICATE-----
-----BEGIN EC CERT-----
MIIB4TCCAWcCCQDNvJ6OSzyk+jAKBggqhkjOPQQDAjBaMQswCQYDVQQGEwJnYjEM
MAoGA1UECAwDaWJtMQwwCgYDVQQHDANpYm0xDDAKBgNVBAoMA2libTETMBEGA1UE
CwwKYmxvY2tjaGFpbjEMMAoGA1UEAwwDaWJtMB4XDTE4MDcxMjE0MjAyOVoXDTI4
MDcwOTE0MjAyOVowWjELMAkGA1UEBhMCZ2IxDDAKBgNVBAgMA2libTEMMAoGA1UE
BwwDaWJtMQwwCgYDVQQKDANpYm0xEzARBgNVBAsMCmJsb2NrY2hhaW4xDDAKBgNV
BAMMA2libTB2MBAGByqGSM49AgEGBSuBBAAiA2IABBZMuR7DBRGF7iBaTn4yD368
0gNNUcI/ktPo2j1gv+ief6hGHH+s0qGwB5sZlCAGgmmzextA95F2H5HJAG5AsfE8
MTs+ZN+eq1jh5KQhGuPYVNF6rckW1iuMpc8+bKwQJTAKBggqhkjOPQQDAgNoADBl
AjAcqFjc35SgU8BXrdPB9ZuHqrrGemXiO54CswaWXxriD8tKcDmMCPSpdELmVwmw
ND8CMQDPdGalkIdXkkxLcuHfuTWEuAsYusWAxEiEF2w5Snq0Cu/E1jPeVZBES/9N
i6dOfok=
----- END EC CERT -----
-----END CERTIFICATE-----`;

            expect(makeRealPem(myCert)).to.deep.equal(myChangedCert);
        });
    });

    describe('_preventMalleability', () => {
        const _preventMalleability = ShimCrypto.__get__('_preventMalleability');

        it ('should throw an error if cannot find half order', () => {
            expect(() => {
                _preventMalleability('some sig', {
                    name: 'some name'
                });
            }).to.throw(/Can not find the half order needed to calculate "s" value for immalleable signatures. Unsupported curve name: some name/);
        });

        it ('should return sig for a low s', () => {
            const halfOrdersForCurve = ShimCrypto.__get__('halfOrdersForCurve');

            const sig = {
                s: {
                    cmp: sinon.stub().returns(0)
                }
            };

            const result = _preventMalleability(sig, {
                name: 'secp256r1'
            });

            expect(result).to.deep.equal(sig);
            expect(sig.s.cmp.calledOnce).to.be.ok;
            expect(sig.s.cmp.firstCall.args).to.deep.equal([halfOrdersForCurve.secp256r1]);
        });

        it ('should handle s larger than half', () => {
            const subStub = sinon.stub().returns('some sub');

            const saveBN = ShimCrypto.__get__('BN');

            const mockBN = sinon.spy(() => {
                const bnStubInstance = sinon.createStubInstance(saveBN);
                bnStubInstance.sub = subStub;
                return bnStubInstance;
            });
            ShimCrypto.__set__('BN', mockBN);

            const sig = {
                s: {
                    cmp: sinon.stub().returns(1)
                }
            };

            const curveParams = {
                name: 'secp256r1',
                n: {
                    toString: sinon.stub().returns('some string')
                }
            };

            const result = _preventMalleability(sig, curveParams);

            expect(result.s).to.deep.equal('some sub');
            expect(mockBN.calledWithNew).to.be.ok;
            expect(mockBN.firstCall.args).to.deep.equal(['some string', 16]);
            expect(curveParams.n.toString.calledOnce).to.be.ok;
            expect(curveParams.n.toString.firstCall.args).to.deep.equal([16]);

            ShimCrypto.__set__('BN', saveBN);
        });
    });

    describe('_checkMalleability', () => {
        const _checkMalleability = ShimCrypto.__get__('_checkMalleability');

        it ('should throw an error if cannot find half order', () => {
            expect(() => {
                _checkMalleability('some sig', {
                    name: 'some name'
                });
            }).to.throw(/Can not find the half order needed to calculate "s" value for immalleable signatures. Unsupported curve name: some name/);
        });

        it ('should throw an error if signature object fails to load correctly (no r)', () => {
            const saveSig = ShimCrypto.__get__('Signature');

            const mockSignature = sinon.spy(() => {
                return sinon.createStubInstance(saveSig);
            });

            ShimCrypto.__set__('Signature', mockSignature);

            expect(() => {
                _checkMalleability('some sig', {
                    name: 'secp256r1'
                });
            }).to.throw(/Failed to load the signature object from the bytes/);

            ShimCrypto.__set__('Signature', saveSig);
        });

        it ('should throw an error if signature object fails to load correctly (no s)', () => {
            const saveSig = ShimCrypto.__get__('Signature');

            const mockSignature = sinon.spy(() => {
                const sigStubInstance = sinon.createStubInstance(saveSig);
                sigStubInstance.r = 'something';
                return sigStubInstance;
            });

            ShimCrypto.__set__('Signature', mockSignature);

            expect(() => {
                _checkMalleability('some sig', {
                    name: 'secp256r1'
                });
            }).to.throw(/Failed to load the signature object from the bytes/);

            ShimCrypto.__set__('Signature', saveSig);
        });

        it ('should return false when s is larger than half the order', () => {
            const halfOrdersForCurve = ShimCrypto.__get__('halfOrdersForCurve');
            const saveSig = ShimCrypto.__get__('Signature');

            const cmpStub = sinon.stub().returns(1);

            const mockSignature = sinon.spy(() => {
                const sigStubInstance = sinon.createStubInstance(saveSig);
                sigStubInstance.r = 'something';
                sigStubInstance.s = {
                    cmp: cmpStub
                };
                return sigStubInstance;
            });

            ShimCrypto.__set__('Signature', mockSignature);

            expect(_checkMalleability('some sig', {
                name: 'secp256r1'
            })).to.deep.equal(false);
            expect(cmpStub.calledOnce).to.be.ok;
            expect(cmpStub.firstCall.args).to.deep.equal([halfOrdersForCurve.secp256r1]);

            ShimCrypto.__set__('Signature', saveSig);
        });

        it ('should return false when s is lower than half the order', () => {
            const halfOrdersForCurve = ShimCrypto.__get__('halfOrdersForCurve');
            const saveSig = ShimCrypto.__get__('Signature');

            const cmpStub = sinon.stub().returns(0);

            const mockSignature = sinon.spy(() => {
                const sigStubInstance = sinon.createStubInstance(saveSig);
                sigStubInstance.r = 'something';
                sigStubInstance.s = {
                    cmp: cmpStub
                };
                return sigStubInstance;
            });

            ShimCrypto.__set__('Signature', mockSignature);

            expect(_checkMalleability('some sig', {
                name: 'secp256r1'
            })).to.deep.equal(true);
            expect(cmpStub.calledOnce).to.be.ok;
            expect(cmpStub.firstCall.args).to.deep.equal([halfOrdersForCurve.secp256r1]);

            ShimCrypto.__set__('Signature', saveSig);
        });
    });
});

// utils
function newShimCrypto(wantedItems) {
    const tmap = new Map();

    if (wantedItems && Array.isArray(wantedItems)) {
        wantedItems.forEach((el) => {
            tmap.set(mapItems[el].key, mapItems[el].value);
        });
    }

    return new ShimCrypto({
        getTransient: () => {
            return tmap;
        }
    });
}

function mockForSignKey() {
    mockImportKey = sinon.stub().returns('some imported signKey');
    ShimCrypto.__set__('importKey', mockImportKey);

    mockVerifyStub = sinon.stub().returns(true);

    ecStubInstance = sinon.createStubInstance(saveEC);
    ecStubInstance.keyFromPrivate = sinon.stub().returns('some key from private');
    ecStubInstance.keyFromPublic = sinon.stub().returns({
        verify: mockVerifyStub
    });
    ecStubInstance.sign = sinon.stub().returns('some signed message');
    mockEC = sinon.spy(() => {
        return ecStubInstance;
    });
    ShimCrypto.__set__('EC', mockEC);
}

function clearSignKeyMocks() {
    mockImportKey = null;
    ecStubInstance = null;
    mockEC = null;

    ShimCrypto.__set__('importKey', saveImportKey);
    ShimCrypto.__set__('EC', saveEC);
}
