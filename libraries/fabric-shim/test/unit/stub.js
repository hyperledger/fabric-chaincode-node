/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
/* global describe it beforeEach afterEach after  */

const sinon = require('sinon');
const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const rewire = require('rewire');
const fabprotos = require('../../bundle');

const Stub = rewire('../../lib/stub.js');

class DummyIterator {
    constructor() {
        this.items = [1, 2, 3, 4, 5];
        this.count = 0;
        this.closeCalled = false;
    }

    async next() {
        return new Promise((resolve, reject) => {
            if (this.count === this.items.length) {
                resolve({done: true});
            }
            resolve({value: this.items[this.count], done: false});
            this.count++;
        });
    }
    async close() {
        this.closeCalled = true;
        return Promise.resolve();
    }
}

describe('Stub', () => {
    describe('validateCompositeKeyAttribute', () => {
        const validateCompositeKeyAttribute = Stub.__get__('validateCompositeKeyAttribute');

        it ('should throw an error if no attribute passed', () => {
            expect(() => {
                validateCompositeKeyAttribute();
            }).to.throw(/object type or attribute not a non-zero length string/);
        });

        it ('should throw an error if attribute not string', () => {
            expect(() => {
                validateCompositeKeyAttribute(100);
            }).to.throw(/object type or attribute not a non-zero length string/);
        });

        it ('should throw an error if attribute empty string', () => {
            expect(() => {
                validateCompositeKeyAttribute('');
            }).to.throw(/object type or attribute not a non-zero length string/);
        });
    });

    describe('computeProposalBinding', () => {
        it ('should return hash of decodedSP', () => {
            const computeProposalBinding = Stub.__get__('computeProposalBinding');

            const decodedSP = {
                proposal: {
                    header: {
                        signatureHeader: {
                            nonce: Buffer.from('100'),
                            creator: Buffer.from('some creator')
                        },
                        channelHeader: {
                            epoch: {
                                high: 10,
                                low: 1
                            }
                        }
                    }
                }
            };

            expect(computeProposalBinding(decodedSP)).to.deep.equal('ff7e9beabf035d45cb5922278f423ba92f1e85d43d54c2304038f2f2b131625b');
        });
    });

    describe('convertToAsyncIterator', () => {
        let dummyIteratorPromise;
        const convertToAsyncIterator = Stub.__get__('convertToAsyncIterator');
        beforeEach(() => {
            dummyIteratorPromise = Promise.resolve(new DummyIterator());
        });

        it('should inject a function into the promise that returns an object with the correct methods', () => {
            const returnedPromise = convertToAsyncIterator(dummyIteratorPromise);
            expect(returnedPromise[Symbol.asyncIterator]).to.be.a('function');
            const returnedObj = returnedPromise[Symbol.asyncIterator]();
            expect(returnedObj.next).to.be.a('function');
            expect(returnedObj.return).to.be.a('function');
        });

        it('should be possible to iterate using async for of', async () => {
            const returnedPromise = convertToAsyncIterator(dummyIteratorPromise);
            const allResults = [];
            for await (const res of returnedPromise) {
                allResults.push(res);
            }
            expect(allResults).to.deep.equal([1, 2, 3, 4, 5]);
            const iterator = await dummyIteratorPromise;
            expect(iterator.closeCalled).to.be.true;
        });

        it('should close the iterator if we break out of the loop', async () => {
            const returnedPromise = convertToAsyncIterator(dummyIteratorPromise);
            const allResults = [];
            let cc = 0;
            for await (const res of returnedPromise) {
                allResults.push(res);
                cc++;
                if (cc === 3) {
                    break;
                }
            }
            expect(allResults).to.deep.equal([1, 2, 3]);
            const iterator = await dummyIteratorPromise;
            expect(iterator.closeCalled).to.be.true;
        });

        it('should close the iterator if we break out of the loop straight away', async () => {
            const returnedPromise = convertToAsyncIterator(dummyIteratorPromise);
            const allResults = [];
            for await (const res of returnedPromise) {
                res;
                break;
            }
            expect(allResults).to.deep.equal([]);
            const iterator = await dummyIteratorPromise;
            expect(iterator.closeCalled).to.be.true;
        });

        it('should close the iterator if we throw out of the loop', async () => {
            const returnedPromise = convertToAsyncIterator(dummyIteratorPromise);
            const allResults = [];
            let cc = 0;

            try {
                for await (const res of returnedPromise) {
                    allResults.push(res);
                    cc++;
                    if (cc === 3) {
                        throw new Error('get me out of here');
                    }
                }
            } catch (err) { // eslint-disable-noempty

            }
            expect(allResults).to.deep.equal([1, 2, 3]);
            const iterator = await dummyIteratorPromise;
            expect(iterator.closeCalled).to.be.true;
        });

        it('should work with a promise that returns an object with an iterator property deconstructed by the caller', async () => {
            const dummyObjWithIteratorPromise = Promise.resolve({iterator: new DummyIterator(), metadata: 'stuff'})
                .then((result) => result.iterator);
            const returnedPromise = convertToAsyncIterator(dummyObjWithIteratorPromise);
            const allResults = [];
            for await (const res of returnedPromise) {
                allResults.push(res);
            }
            expect(allResults).to.deep.equal([1, 2, 3, 4, 5]);
            const iterator = await dummyObjWithIteratorPromise;
            expect(iterator.closeCalled).to.be.true;
        });

        it('should work with a promise that returns an object with an iterator property not deconstructed by caller', async () => {
            const dummyObjWithIteratorPromise = Promise.resolve({iterator: new DummyIterator(), metadata: 'stuff'});
            const returnedPromise = convertToAsyncIterator(dummyObjWithIteratorPromise);
            const allResults = [];
            for await (const res of returnedPromise) {
                allResults.push(res);
            }
            expect(allResults).to.deep.equal([1, 2, 3, 4, 5]);
            const {iterator} = await dummyObjWithIteratorPromise;
            expect(iterator.closeCalled).to.be.true;
        });


        it('should handle a promise rejection', async () => {
            const dummyIteratorRejection = Promise.reject(new Error('im rejected'));
            const returnedPromise = convertToAsyncIterator(dummyIteratorRejection);
            const allResults = [];
            try {
                for await (const res of returnedPromise) {
                    allResults.push(res);
                }
            } catch (err) {
                expect(err.message).to.equal('im rejected');
            }

        });


    });

    describe('ChaincodeStub', () => {
        const sandbox = sinon.createSandbox();

        const buf1 = Buffer.from('invoke');
        const buf2 = Buffer.from('someKey');
        const buf3 = Buffer.from('someValue');

        const decodedProposal = {
            header: Buffer.from('some header'),
            payload: Buffer.from('some payload')
        };

        const decodedCCPP = {
            TransientMap: {
                key1: 'value1',
                key2: 'value2'
            }
        };

        const decodedHeader = {
            signatureHeader: 'some signature header',
            channelHeader: 'somne channel header'
        };

        const decodedSigHeader = {
            nonce: Buffer.from('some nonce'),
            creator: 'some creator'
        };

        const decodedChannelHeader = {
            timestamp: 'some timestamp'
        };

        let _proposalProtoProposalDecodeStub;
        let _proposalProtoChaincodeProposalPayloadDecodeStub;
        let _commonProtoHeaderDecodeStub;
        let _commonProtoSignatureHeaderDecodeStub;
        let _commonProtoChannelHeaderDecodeStub;
        let _idProtoSerializedIdentityDecodeStub;

        beforeEach(() => {
            _proposalProtoProposalDecodeStub = sandbox.stub(fabprotos.protos.Proposal, 'decode').returns(decodedProposal);
            _proposalProtoChaincodeProposalPayloadDecodeStub = sandbox.stub(fabprotos.protos.ChaincodeProposalPayload, 'decode').returns(decodedCCPP);

            _commonProtoHeaderDecodeStub = sandbox.stub(fabprotos.common.Header, 'decode').returns(decodedHeader);
            _commonProtoSignatureHeaderDecodeStub = sandbox.stub(fabprotos.common.SignatureHeader, 'decode').returns(decodedSigHeader);
            _commonProtoChannelHeaderDecodeStub = sandbox.stub(fabprotos.common.ChannelHeader, 'decode').returns(decodedChannelHeader);

            _idProtoSerializedIdentityDecodeStub = sandbox.stub(fabprotos.msp.SerializedIdentity, 'decode').returns('some creator');
        });

        afterEach(() => {
            sandbox.restore();
        });

        it ('should set up the vars and do nothing more with no signed proposal', () => {
            const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                args: [buf1, buf2, buf3]
            });

            expect(stub.handler).to.deep.equal('dummyClient');
            expect(stub.channel_id).to.deep.equal('dummyChannelId');
            expect(stub.txId).to.deep.equal('dummyTxid');
            expect(stub.args).to.deep.equal(['invoke', 'someKey', 'someValue']);
        });

        it ('should throw an error for an invalid proposal', () => {
            _proposalProtoProposalDecodeStub.restore();
            _proposalProtoProposalDecodeStub = sandbox.stub(fabprotos.protos.Proposal, 'decode').throws();

            expect(() => {
                new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: [buf1, buf2, buf3]
                }, 'badProposal');
            }).to.throw(/Failed extracting proposal from signedProposal/);
        });

        it ('should throw an error for a proposal with an empty header', () => {
            _proposalProtoProposalDecodeStub.restore();
            _proposalProtoProposalDecodeStub = sandbox.stub(fabprotos.protos.Proposal, 'decode').returns({});

            expect(() => {
                new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: [buf1, buf2, buf3]
                }, {
                    signature: 'some signature',
                    proposal_bytes: 'some bytes'
                });
            }).to.throw(/Proposal header is empty/);
        });

        it ('should throw an error for a proposal with an empty payload', () => {
            _proposalProtoProposalDecodeStub.restore();
            _proposalProtoProposalDecodeStub = sandbox.stub(fabprotos.protos.Proposal, 'decode').returns({header: decodedProposal.header});

            expect(() => {
                new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: [buf1, buf2, buf3]
                }, {
                    signature: 'some signature',
                    proposal_bytes: 'some bytes'
                });
            }).to.throw(/Proposal payload is empty/);
        });

        it ('should throw an error for a proposal with an invalid header', () => {
            _commonProtoHeaderDecodeStub.restore();
            _commonProtoHeaderDecodeStub = sandbox.stub(fabprotos.common.Header, 'decode').throws();

            expect(() => {
                new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: [buf1, buf2, buf3]
                }, {
                    signature: 'some signature',
                    proposal_bytes: 'some bytes'
                });
            }).to.throw(/Could not extract the header from the proposal/);
        });

        it ('should throw an error for a proposal with an invalid signature header', () => {
            _commonProtoSignatureHeaderDecodeStub.restore();
            _commonProtoSignatureHeaderDecodeStub = sandbox.stub(fabprotos.common.SignatureHeader, 'decode').throws();

            expect(() => {
                new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: [buf1, buf2, buf3]
                }, {
                    signature: 'some signature',
                    proposal_bytes: 'some bytes'
                });
            }).to.throw(/Decoding SignatureHeader failed/);
        });

        it ('should throw an error for a proposal with an invalid creator', () => {
            _idProtoSerializedIdentityDecodeStub.restore();
            _idProtoSerializedIdentityDecodeStub = sandbox.stub(fabprotos.msp.SerializedIdentity, 'decode').throws();

            expect(() => {
                new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: [buf1, buf2, buf3]
                }, {
                    signature: 'some signature',
                    proposal_bytes: 'some bytes'
                });
            }).to.throw(/Decoding SerializedIdentity failed/);
        });

        it ('should throw an error for a proposal with an invalid channelHeader', () => {
            _commonProtoChannelHeaderDecodeStub.restore();
            _commonProtoChannelHeaderDecodeStub = sandbox.stub(fabprotos.common.ChannelHeader, 'decode').throws();

            expect(() => {
                new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: [buf1, buf2, buf3]
                }, {
                    signature: 'some signature',
                    proposal_bytes: 'some bytes'
                });
            }).to.throw(/Decoding ChannelHeader failed/);
        });

        it ('should throw an error for a proposal with an invalid payload', () => {
            _proposalProtoChaincodeProposalPayloadDecodeStub.restore();
            sandbox.stub(fabprotos.protos.ChaincodeProposalPayload, 'decode').throws();

            expect(() => {
                new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: [buf1, buf2, buf3]
                }, {
                    signature: 'some signature',
                    proposal_bytes: 'some bytes'
                });
            }).to.throw(/Decoding ChaincodeProposalPayload failed/);
        });

        it('should set all the env vars with a valid signed proposal', () => {
            const saveComputeProposalBinding = Stub.__get__('computeProposalBinding');

            const mockComputeProposalBinding = sinon.stub().returns('some proposal binding');
            Stub.__set__('computeProposalBinding', mockComputeProposalBinding);

            const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                args: [buf1, buf2, buf3]
            }, {
                signature: 'some signature',
                proposal_bytes: 'some bytes'
            });

            expect(stub.handler).to.deep.equal('dummyClient');
            expect(stub.channel_id).to.deep.equal('dummyChannelId');
            expect(stub.txId).to.deep.equal('dummyTxid');
            expect(stub.args).to.deep.equal(['invoke', 'someKey', 'someValue']);
            expect(stub.proposal).to.deep.equal(decodedProposal);
            expect(stub.txTimestamp).to.deep.equal('some timestamp');
            expect(stub.creator).to.deep.equal('some creator');
            expect(stub.transientMap.get('key1')).to.equal('value1');
            expect(stub.transientMap.get('key2')).to.equal('value2');
            expect(stub.signedProposal).to.deep.equal({
                signature: 'some signature',
                proposal: {
                    header: {
                        signatureHeader: {
                            creator: 'some creator',
                            nonce: Buffer.from('some nonce')
                        },
                        channelHeader: decodedChannelHeader
                    },
                    payload: decodedCCPP
                }
            });
            expect(stub.binding).to.deep.equal('some proposal binding');

            expect(_proposalProtoProposalDecodeStub.calledOnce).to.be.true;
            expect(_proposalProtoProposalDecodeStub.firstCall.args).to.deep.equal(['some bytes']);
            expect(_commonProtoHeaderDecodeStub.calledOnce).to.be.true;
            expect(_commonProtoHeaderDecodeStub.firstCall.args).to.deep.equal([decodedProposal.header]);
            expect(_commonProtoSignatureHeaderDecodeStub.calledOnce).to.be.true;
            expect(_commonProtoSignatureHeaderDecodeStub.firstCall.args).to.deep.equal([decodedHeader.signatureHeader]);
            expect(_idProtoSerializedIdentityDecodeStub.calledOnce).to.be.true;
            expect(_idProtoSerializedIdentityDecodeStub.firstCall.args).to.deep.equal([decodedSigHeader.creator]);
            expect(_commonProtoChannelHeaderDecodeStub.calledOnce).to.be.true;
            expect(_commonProtoChannelHeaderDecodeStub.firstCall.args).to.deep.equal([decodedHeader.channelHeader]);
            expect(_proposalProtoChaincodeProposalPayloadDecodeStub.calledOnce).to.be.true;
            expect(_proposalProtoChaincodeProposalPayloadDecodeStub.firstCall.args).to.deep.equal([decodedProposal.payload]);

            Stub.__set__('computeProposalBinding', saveComputeProposalBinding);
        });

        describe('getArgs', () => {
            it ('should return the args', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: [buf1, buf2, buf3]
                });

                expect(stub.getArgs()).to.deep.equal(['invoke', 'someKey', 'someValue']);
            });
        });

        describe('getStringArgs', () => {
            it ('should return the args', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: [buf1, buf2, buf3]
                });

                expect(stub.getStringArgs()).to.deep.equal(['invoke', 'someKey', 'someValue']);
            });
        });

        describe('getBufferArgs', () => {
            it ('should return the args', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: [buf1, buf2, buf3]
                });

                expect(stub.getBufferArgs()).to.deep.equal([buf1, buf2, buf3]);
            });
        });

        describe('getFunctionAndParameters', () => {
            it ('should return the function name parameters', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: [buf1, buf2, buf3]
                });

                expect(stub.getFunctionAndParameters()).to.deep.equal({
                    fcn: 'invoke',
                    params: ['someKey', 'someValue']
                });
            });

            it ('should return string for function and empty array as param if only one arg', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: [buf1]
                });

                expect(stub.getFunctionAndParameters()).to.deep.equal({
                    fcn: 'invoke',
                    params: []
                });
            });

            it ('should return empty string for function and empty array for params if no args', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                expect(stub.getFunctionAndParameters()).to.deep.equal({
                    fcn: '',
                    params: []
                });
            });
        });

        describe('getTxID', () => {
            it ('should return txId', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                expect(stub.getTxID()).to.deep.equal('dummyTxid');
            });
        });

        describe('getChannelID', () => {
            it ('should return channel_id', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                expect(stub.getChannelID()).to.deep.equal('dummyChannelId');
            });
        });

        describe('getCreator', () => {
            it ('should return creator', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                stub.creator = 'some creator';

                expect(stub.getCreator()).to.deep.equal('some creator');
            });
        });

        describe('getMspID', () => {
            let mspID;

            beforeEach(() => {
                if ('CORE_PEER_LOCALMSPID' in process.env) {
                    mspID = process.env.CORE_PEER_LOCALMSPID;
                }
            });
    
            afterEach(() => {
                delete process.env.CORE_PEER_LOCALMSPID;
                if (mspID) {
                    process.env.CORE_PEER_LOCALMSPID = mspID;
                }
            });

            it ('should return MSPID', () => {
                process.env.CORE_PEER_LOCALMSPID = 'some MSPID';

                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                expect(stub.getMspID()).to.deep.equal('some MSPID');
            });

            it ('should throw Error if MSPID is not available', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                expect(() => {
                    stub.getMspID()
                }).to.throw('CORE_PEER_LOCALMSPID is unset in chaincode process');
            });
        });

        describe('getTransient', () => {
            it ('should return transient map', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                stub.transientMap = 'some transient map';

                expect(stub.getTransient()).to.deep.equal('some transient map');
            });
        });

        describe('getSignedProposal', () => {
            it ('should return signed proposal', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                stub.signedProposal = 'some signed proposal';

                expect(stub.getSignedProposal()).to.deep.equal('some signed proposal');
            });
        });

        describe('getTxTimestamp', () => {
            it ('should return transaction timestamp', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                stub.txTimestamp = 'some timestamp';

                expect(stub.getTxTimestamp()).to.deep.equal('some timestamp');
            });
        });

        describe('getDateTimestamp', () => {
            it ('should return transaction date as Node.js Date object', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
                stub.txTimestamp = {seconds: 1606233385, nanos: 54000000};

                expect(stub.getDateTimestamp()).to.deep.equal(new Date(1606233385054));
            });
        });

        describe('getBinding', () => {
            it ('should return binding', () => {
                const stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                stub.binding = 'some binding';

                expect(stub.getBinding()).to.deep.equal('some binding');
            });
        });

        describe('getState', () => {
            it ('should return handler.handleGetState', async () => {
                const handleGetStateStub = sinon.stub().resolves('some state');

                const stub = new Stub({
                    handleGetState: handleGetStateStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const result = await stub.getState('a key');

                expect(result).to.deep.equal('some state');
                expect(handleGetStateStub.calledOnce).to.be.true;
                expect(handleGetStateStub.firstCall.args).to.deep.equal(['', 'a key', 'dummyChannelId', 'dummyTxid']);
            });
        });

        describe('putState', () => {
            it ('should return handler.handlePutState', async () => {
                const handlePutStateStub = sinon.stub().resolves('some state');

                const stub = new Stub({
                    handlePutState: handlePutStateStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const result = await stub.putState('a key', 'a value');

                expect(result).to.deep.equal('some state');
                expect(handlePutStateStub.calledOnce).to.be.true;
                expect(handlePutStateStub.firstCall.args).to.deep.equal(['', 'a key', Buffer.from('a value'), 'dummyChannelId', 'dummyTxid']);
            });
            it ('should return handler.handlePutState', async () => {
                const handlePutStateStub = sinon.stub().resolves('some state');

                const stub = new Stub({
                    handlePutState: handlePutStateStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const result = await stub.putState('a key', {a:'value'});

                expect(result).to.deep.equal('some state');
                expect(handlePutStateStub.calledOnce).to.be.true;
                expect(handlePutStateStub.firstCall.args).to.deep.equal(['', 'a key', {a:'value'}, 'dummyChannelId', 'dummyTxid']);
            });
        });

        describe('deleteState', () => {
            it ('should return handler.handleDeleteState', async () => {
                const handleDeleteStateStub = sinon.stub().resolves('some state');

                const stub = new Stub({
                    handleDeleteState: handleDeleteStateStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const result = await stub.deleteState('a key');

                expect(result).to.deep.equal('some state');
                expect(handleDeleteStateStub.calledOnce).to.be.true;
                expect(handleDeleteStateStub.firstCall.args).to.deep.equal(['', 'a key', 'dummyChannelId', 'dummyTxid']);
            });
        });

        describe('setStateValidationParameter', () => {
            it('should return handler.handlePutStateMetadata', async () => {
                const handlePutStateMetadataStub = sinon.stub().resolves('nothing');
                const stub = new Stub({
                    handlePutStateMetadata: handlePutStateMetadataStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
                const ep = Buffer.from('someEndorsementPolicy');

                const nothing = await stub.setStateValidationParameter('aKey', ep);
                expect(nothing).to.deep.equal('nothing');
                sinon.assert.calledOnce(handlePutStateMetadataStub);
                sinon.assert.calledWith(handlePutStateMetadataStub, '', 'aKey', 'VALIDATION_PARAMETER', ep, 'dummyChannelId', 'dummyTxid');
            });
        });

        describe('getStateValidationParameter', () => {
            it('should return handler.handleGetStateMetadata', async () => {
                const handleGetStateMetadataStub = sinon.stub().resolves({VALIDATION_PARAMETER: 'some metadata'});
                const stub = new Stub({
                    handleGetStateMetadata: handleGetStateMetadataStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
                const ep = await stub.getStateValidationParameter('aKey');
                expect(ep).to.deep.equal('some metadata');
                sinon.assert.calledOnce(handleGetStateMetadataStub);
                sinon.assert.calledWith(handleGetStateMetadataStub, '', 'aKey', 'dummyChannelId', 'dummyTxid');
            });
        });

        describe('getStateByRange', () => {
            it ('should return handler.handleGetStateByRange', async () => {
                const handleGetStateByRangeStub = sinon.stub().resolves({iterator: 'some state'});

                const stub = new Stub({
                    handleGetStateByRange: handleGetStateByRangeStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const result = await stub.getStateByRange('start key', 'end key');

                expect(result).to.deep.equal('some state');
                expect(handleGetStateByRangeStub.calledOnce).to.be.true;
                expect(handleGetStateByRangeStub.firstCall.args).to.deep.equal(['', 'start key', 'end key', 'dummyChannelId', 'dummyTxid']);
            });

            it ('should return handler.handleGetStateByRange using empty key substitute', async () => {
                const handleGetStateByRangeStub = sinon.stub().resolves({iterator: 'some state'});

                const stub = new Stub({
                    handleGetStateByRange: handleGetStateByRangeStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const EMPTY_KEY_SUBSTITUTE = Stub.__get__('EMPTY_KEY_SUBSTITUTE');

                const result = await stub.getStateByRange(null, 'end key');

                expect(result).to.deep.equal('some state');
                expect(handleGetStateByRangeStub.calledOnce).to.be.true;
                expect(handleGetStateByRangeStub.firstCall.args).to.deep.equal(['', EMPTY_KEY_SUBSTITUTE, 'end key', 'dummyChannelId', 'dummyTxid']);
            });

            it('should throw error if using compositekey', async () => {
                const handleGetStateByRangeStub = sinon.stub().resolves({iterator: 'some state'});

                const stub = new Stub({
                    handleGetStateByRange: handleGetStateByRangeStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const compositeStartKey = stub.createCompositeKey('obj', ['attr1']);
                expect(stub.getStateByRange(compositeStartKey, 'end key'))
                    .eventually
                    .be
                // eslint-disable-next-line no-control-regex
                    .rejectedWith(/first character of the key \[\u0000obj\u0000attr1\u0000] contains a null character which is not allowed/);
            });
        });

        describe('getStateByRangeWithPagination', () => {
            it('should throw error if using compositekey', async () => {
                const handleGetStateByRangeStub = sinon.stub().resolves({iterator: 'some state'});

                const stub = new Stub({
                    handleGetStateByRange: handleGetStateByRangeStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const compositeStartKey = stub.createCompositeKey('obj', ['attr1']);
                expect(stub.getStateByRangeWithPagination(compositeStartKey, 'end key', 3, ''))
                    .eventually
                    .be
                // eslint-disable-next-line no-control-regex
                    .rejectedWith(/first character of the key \[\u0000obj\u0000attr1\u0000] contains a null character which is not allowed/);
            });

            it('should have default startKey eqls EMPTY_KEY_SUBSTITUTE', async () => {
                const EMPTY_KEY_SUBSTITUTE = Stub.__get__('EMPTY_KEY_SUBSTITUTE');
                const handleGetStateByRangeStub = sinon.stub().resolves('some state');

                const stub = new Stub({
                    handleGetStateByRange: handleGetStateByRangeStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const result = await stub.getStateByRangeWithPagination(null, 'end key', 3);

                expect(result).to.deep.equal('some state');
                expect(handleGetStateByRangeStub.calledOnce).to.be.true;
                const metadataBuffer = fabprotos.protos.QueryResponseMetadata.encode({
                    bookmark: '',
                    fetchedRecordsCount: 3
                }).finish();
                expect(handleGetStateByRangeStub.firstCall.args).to.deep.equal(['', EMPTY_KEY_SUBSTITUTE, 'end key', 'dummyChannelId', 'dummyTxid', metadataBuffer]);
            });

            it('should have default bookmark eqls an empty string', async () => {
                const handleGetStateByRangeStub = sinon.stub().resolves('some state');

                const stub = new Stub({
                    handleGetStateByRange: handleGetStateByRangeStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const result = await stub.getStateByRangeWithPagination('start key', 'end key', 3);

                expect(result).to.deep.equal('some state');
                expect(handleGetStateByRangeStub.calledOnce).to.be.true;
                const metadataBuffer = fabprotos.protos.QueryResponseMetadata.encode({
                    bookmark: '',
                    fetchedRecordsCount: 3
                }).finish();
                expect(handleGetStateByRangeStub.firstCall.args).to.deep.equal(['', 'start key', 'end key', 'dummyChannelId', 'dummyTxid', metadataBuffer]);
            });

            it('should have default bookmark eqls an empty string', async () => {
                const handleGetStateByRangeStub = sinon.stub().resolves('some state');

                const stub = new Stub({
                    handleGetStateByRange: handleGetStateByRangeStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const result = await stub.getStateByRangeWithPagination('start key', 'end key', 3, 'a bookmark');

                expect(result).to.deep.equal('some state');
                expect(handleGetStateByRangeStub.calledOnce).to.be.true;
                const metadataBuffer = fabprotos.protos.QueryResponseMetadata.encode({
                    bookmark: 'a bookmark',
                    fetchedRecordsCount: 3
                }).finish();
                expect(handleGetStateByRangeStub.firstCall.args).to.deep.equal(['', 'start key', 'end key', 'dummyChannelId', 'dummyTxid', metadataBuffer]);
            });
        });

        describe('getQueryResult', () => {
            it ('should return handler.handleGetQueryResult', async () => {
                const handleGetQueryResultStub = sinon.stub().resolves({iterator: 'some query result'});

                const stub = new Stub({
                    handleGetQueryResult: handleGetQueryResultStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const result = await stub.getQueryResult('a query');

                expect(result).to.deep.equal('some query result');
                expect(handleGetQueryResultStub.calledOnce).to.be.true;
                expect(handleGetQueryResultStub.firstCall.args).to.deep.equal(['', 'a query', null, 'dummyChannelId', 'dummyTxid']);
            });
        });

        describe('getQueryResultWithPagination', () => {
            it('should have default bookmark equals an empty string', async () => {
                const handleGetQueryResultStub = sinon.stub().resolves('some query result');

                const stub = new Stub({
                    handleGetQueryResult: handleGetQueryResultStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const result = await stub.getQueryResultWithPagination('a query', 3);

                expect(result).to.deep.equal('some query result');
                expect(handleGetQueryResultStub.calledOnce).to.be.true;
                const metadata = handleGetQueryResultStub.firstCall.args[2];
                const decoded = fabprotos.protos.QueryMetadata.decode(metadata);
                expect(decoded.pageSize).to.equal(3);
                expect(decoded.bookmark).to.equal('');
            });

            it('should have default bookmark equals an empty string', async () => {
                const handleGetQueryResultStub = sinon.stub().resolves('some query result');

                const stub = new Stub({
                    handleGetQueryResult: handleGetQueryResultStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const result = await stub.getQueryResultWithPagination('a query', 3, 'a bookmark');

                expect(result).to.deep.equal('some query result');
                expect(handleGetQueryResultStub.calledOnce).to.be.true;
                const metadata = handleGetQueryResultStub.firstCall.args[2];
                const decoded = fabprotos.protos.QueryMetadata.decode(metadata);
                expect(decoded.pageSize).to.equal(3);
                expect(decoded.bookmark).to.equal('a bookmark');
            });
        });

        describe('getHistoryForKey', () => {
            it ('should return handler.handleGetHistoryForKey', async () => {
                const handleGetHistoryForKeyStub = sinon.stub().resolves('some history');

                const stub = new Stub({
                    handleGetHistoryForKey: handleGetHistoryForKeyStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const result = await stub.getHistoryForKey('a key');

                expect(result).to.deep.equal('some history');
                expect(handleGetHistoryForKeyStub.calledOnce).to.be.true;
                expect(handleGetHistoryForKeyStub.firstCall.args).to.deep.equal(['a key', 'dummyChannelId', 'dummyTxid']);
            });
        });

        describe('invokeChaincode', () => {
            let stub;
            let handleInvokeChaincodeStub;

            beforeEach(() => {
                handleInvokeChaincodeStub = sinon.stub().resolves('invoked');

                stub = new Stub({
                    handleInvokeChaincode: handleInvokeChaincodeStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
            });

            it ('should return handler.handleInvokeChaincode', async () => {
                const result = await stub.invokeChaincode('chaincodeName', ['some', 'args'], 'someChannel');

                expect(result).to.deep.equal('invoked');
                expect(handleInvokeChaincodeStub.calledOnce).to.be.true;
                expect(handleInvokeChaincodeStub.firstCall.args).to.deep.equal(['chaincodeName/someChannel', ['some', 'args'], 'dummyChannelId', 'dummyTxid']);
            });

            it ('should return handler.handleInvokeChaincode handling no channel passed', async () => {
                const result = await stub.invokeChaincode('chaincodeName', ['some', 'args']);

                expect(result).to.deep.equal('invoked');
                expect(handleInvokeChaincodeStub.calledOnce).to.be.true;
                expect(handleInvokeChaincodeStub.firstCall.args).to.deep.equal(['chaincodeName', ['some', 'args'], 'dummyChannelId', 'dummyTxid']);
            });
        });

        describe('setEvent', () => {
            let stub;

            beforeEach(() => {
                stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
            });

            it ('should throw an error when name is not a string', () => {
                expect(() => {
                    stub.setEvent();
                }).to.throw(/Event name must be a non-empty string/);
            });

            it ('should throw an error when name is empty string', () => {
                expect(() => {
                    stub.setEvent('');
                }).to.throw(/Event name must be a non-empty string/);
            });

            it ('should set an event', () => {
                stub.setEvent('some name', Buffer.from('some payload'));
                expect(stub.chaincodeEvent.event_name).to.equal('some name');
                expect(stub.chaincodeEvent.payload).to.deep.equal(Buffer.from('some payload'));
            });
        });

        describe('createCompositeKey', () => {
            const saveValidate = Stub.__get__('validateCompositeKeyAttribute');

            let stub;
            let mockValidate;
            beforeEach(() => {
                mockValidate = sinon.stub().returns();
                Stub.__set__('validateCompositeKeyAttribute', mockValidate);

                stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
            });

            after(() => {
                Stub.__set__('validateCompositeKeyAttribute', saveValidate);
            });

            it ('should throw an error if attributes is not an array', () => {
                expect(() => {
                    stub.createCompositeKey('some type', 'some attributes');
                }).to.throw(/attributes must be an array/);
                expect(mockValidate.calledOnce).to.be.true;
                expect(mockValidate.firstCall.args).to.deep.equal(['some type']);
            });

            it ('should return a composite key', () => {
                const COMPOSITEKEY_NS = Stub.__get__('COMPOSITEKEY_NS');
                const MIN_UNICODE_RUNE_VALUE = Stub.__get__('MIN_UNICODE_RUNE_VALUE');

                const result = stub.createCompositeKey('some type', ['attr1', 'attr2']);

                expect(result).to.deep.equal(`${COMPOSITEKEY_NS}some type${MIN_UNICODE_RUNE_VALUE}attr1${MIN_UNICODE_RUNE_VALUE}attr2${MIN_UNICODE_RUNE_VALUE}`);
                expect(mockValidate.calledThrice).to.be.true;
                expect(mockValidate.firstCall.args).to.deep.equal(['some type']);
                expect(mockValidate.secondCall.args).to.deep.equal(['attr1']);
                expect(mockValidate.thirdCall.args).to.deep.equal(['attr2']);
            });
        });

        describe('splitCompositeKey', () => {
            const COMPOSITEKEY_NS = Stub.__get__('COMPOSITEKEY_NS');
            const MIN_UNICODE_RUNE_VALUE = Stub.__get__('MIN_UNICODE_RUNE_VALUE');

            let stub;
            beforeEach(() => {
                stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
            });

            it ('should return object with empty values when no composite key', () => {
                expect(stub.splitCompositeKey()).to.deep.equal({objectType: null, attributes: []});
            });

            it ('should return object with empty values when composite key only has one character', () => {
                expect(stub.splitCompositeKey(COMPOSITEKEY_NS)).to.deep.equal({objectType: null, attributes: []});
            });

            it ('should return object with empty values when composite key does not have first character as COMPOSITEKEY_NS', () => {
                expect(stub.splitCompositeKey(`some type${COMPOSITEKEY_NS}`)).to.deep.equal({objectType: null, attributes: []});
            });

            it ('should return object with objectType set but no attributes', () => {
                expect(stub.splitCompositeKey(`${COMPOSITEKEY_NS}some type`)).to.deep.equal({objectType: 'some type', attributes: []});
            });

            it ('should return object with objectType set and array of attributes', () => {
                expect(
                    stub.splitCompositeKey(`${COMPOSITEKEY_NS}some type${MIN_UNICODE_RUNE_VALUE}attr1${MIN_UNICODE_RUNE_VALUE}attr2${MIN_UNICODE_RUNE_VALUE}`)
                ).to.deep.equal({objectType: 'some type', attributes: ['attr1', 'attr2']});
            });
        });

        describe('getStateByPartialCompositeKey', () => {
            const MAX_UNICODE_RUNE_VALUE = Stub.__get__('MAX_UNICODE_RUNE_VALUE');
            it ('should return handler.handleGetStateByRange using composite key', async () => {
                const handleGetStateByRangeStub = sinon.stub().resolves({iterator: 'some state'});

                const stub = new Stub({
                    handleGetStateByRange: handleGetStateByRangeStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const createCompositeKeyStub = sinon.stub(stub, 'createCompositeKey').returns('some composite key');
                const result = await stub.getStateByPartialCompositeKey('some type', ['attr1', 'attr2']);

                expect(result).to.deep.equal('some state');
                expect(createCompositeKeyStub.calledOnce).to.be.true;
                expect(createCompositeKeyStub.firstCall.args).to.deep.equal(['some type', ['attr1', 'attr2']]);
                expect(handleGetStateByRangeStub.calledOnce).to.be.true;
                expect(handleGetStateByRangeStub.firstCall.args).to.deep.equal(['', 'some composite key', `some composite key${MAX_UNICODE_RUNE_VALUE}`, 'dummyChannelId', 'dummyTxid']);
            });
        });

        describe('getStateByPartialCompositeKeyWithPagination', () => {
            let response;
            let handleGetStateByRangeStub;

            beforeEach(() => {
                response = {iterator: 'some state', bookmark: 'some bookmark'};
                handleGetStateByRangeStub = sinon.stub().resolves(response);
            });

            it('the default bookmark should equal an empty string', async () => {
                const stub = new Stub({
                    handleGetStateByRange: handleGetStateByRangeStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const createCompositeKeyStub = sinon.stub(stub, 'createCompositeKey').returns('some composite key');
                const result = await stub.getStateByPartialCompositeKeyWithPagination('some type', ['attr1', 'attr2'], 3);

                expect(result).to.deep.equal(response);
                expect(createCompositeKeyStub.calledOnce).to.be.true;
                expect(createCompositeKeyStub.firstCall.args).to.deep.equal(['some type', ['attr1', 'attr2']]);
                expect(handleGetStateByRangeStub.calledOnce).to.be.true;
                const metadata = handleGetStateByRangeStub.firstCall.args[5];
                const decoded = fabprotos.protos.QueryMetadata.decode(metadata);
                expect(decoded.pageSize).to.equal(3);
                expect(decoded.bookmark).to.equal('');
            });

            it('should return getStateByRangeWithPagination with bookmark and pageSize', async () => {
                const stub = new Stub({
                    handleGetStateByRange: handleGetStateByRangeStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });

                const createCompositeKeyStub = sinon.stub(stub, 'createCompositeKey').returns('some composite key');
                const result = await stub.getStateByPartialCompositeKeyWithPagination('some type', ['attr1', 'attr2'], 23, 'a bookmark');
                expect(result).to.deep.equal(response);
                expect(createCompositeKeyStub.calledOnce).to.be.true;
                expect(createCompositeKeyStub.firstCall.args).to.deep.equal(['some type', ['attr1', 'attr2']]);
                expect(handleGetStateByRangeStub.calledOnce).to.be.true;
                const metadata = handleGetStateByRangeStub.firstCall.args[5];
                const decoded = fabprotos.protos.QueryMetadata.decode(metadata);
                expect(decoded.pageSize).to.equal(23);
                expect(decoded.bookmark).to.equal('a bookmark');
            });
        });

        describe('getPrivateData', () => {
            let handleGetStateStub;
            let stub;

            beforeEach(() => {
                handleGetStateStub = sinon.stub().resolves('some state');
                stub = new Stub({
                    handleGetState: handleGetStateStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
            });

            it ('should throw an error if no arguments supplied', async () => {
                const result = stub.getPrivateData();
                await expect(result).to.eventually.be.rejectedWith(Error, 'collection must be a valid string');
            });

            it ('should throw an error if one argument supplied', async () => {
                const result = stub.getPrivateData('some arg');
                await expect(result).to.eventually.be.rejectedWith(Error, 'key must be a valid string');
            });

            it ('should throw an error if collection null', async () => {
                const result = stub.getPrivateData(null, 'some key');
                await expect(result).to.eventually.be.rejectedWith(Error, 'collection must be a valid string');
            });

            it ('should return handler.handleGetState', async () => {
                const result = await stub.getPrivateData('some collection', 'some key');

                expect(result).to.deep.equal('some state');
                expect(handleGetStateStub.calledOnce).to.be.true;
                expect(handleGetStateStub.firstCall.args).to.deep.equal(['some collection', 'some key', 'dummyChannelId', 'dummyTxid']);
            });
        });

        describe('getPrivateDataHash', () => {
            let handleGetPrivateDataHashStub;
            let stub;

            beforeEach(() => {
                handleGetPrivateDataHashStub = sinon.stub().resolves('some state');
                stub = new Stub({
                    handleGetPrivateDataHash: handleGetPrivateDataHashStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
            });

            it ('should throw an error if no arguments supplied', async () => {
                const result = stub.getPrivateDataHash();
                await expect(result).to.eventually.be.rejectedWith(Error, 'collection must be a valid string');
            });

            it ('should throw an error if one argument supplied', async () => {
                const result = stub.getPrivateDataHash('some arg');
                await expect(result).to.eventually.be.rejectedWith(Error, 'key must be a valid string');
            });

            it ('should throw an error if collection null', async () => {
                const result = stub.getPrivateDataHash(null, 'some key');
                await expect(result).to.eventually.be.rejectedWith(Error, 'collection must be a valid string');
            });

            it ('should return handler.handleGetPrivateDataHash', async () => {
                const result = await stub.getPrivateDataHash('some collection', 'some key');

                expect(result).to.deep.equal('some state');
                expect(handleGetPrivateDataHashStub.calledOnce).to.be.true;
                expect(handleGetPrivateDataHashStub.firstCall.args).to.deep.equal(['some collection', 'some key', 'dummyChannelId', 'dummyTxid']);
            });
        });

        describe('putPrivateData', () => {
            let handlePutStateStub;
            let stub;

            beforeEach(() => {
                handlePutStateStub = sinon.stub().resolves('some state');
                stub = new Stub({
                    handlePutState: handlePutStateStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
            });

            it ('should throw an error if no arguments supplied', async () => {
                const result = stub.putPrivateData();
                await expect(result).to.eventually.be.rejectedWith(Error, 'collection must be a valid string');
            });

            it ('should throw an error if one argument supplied', async () => {
                const result = stub.putPrivateData('some arg');
                await expect(result).to.eventually.be.rejectedWith(Error, 'key must be a valid string');
            });

            it ('should throw an error if two arguments supplied', async () => {
                const result = stub.putPrivateData('some arg1', 'some arg2');
                await expect(result).to.eventually.be.rejectedWith(Error, 'value must be valid');
            });

            it ('should throw an error if collection null', async () => {
                const result = stub.putPrivateData(null, 'some key', 'some value');
                await expect(result).to.eventually.be.rejectedWith(Error, 'collection must be a valid string');
            });

            it ('should throw an error if key null', async () => {
                const result = stub.putPrivateData('some collection', null, 'some value');
                await expect(result).to.eventually.be.rejectedWith(Error, 'key must be a valid string');
            });

            it ('should return handler.handlePutState with string', async () => {
                const result = await stub.putPrivateData('some collection', 'some key', 'some value');
                expect(result).to.deep.equal('some state');
                expect(handlePutStateStub.calledOnce).to.be.true;
                expect(handlePutStateStub.firstCall.args).to.deep.equal(['some collection', 'some key', Buffer.from('some value'), 'dummyChannelId', 'dummyTxid']);
            });

            it ('should return handler.handlePutState with object', async () => {
                const result = await stub.putPrivateData('some collection', 'some key', {some :'value'});

                expect(result).to.deep.equal('some state');
                expect(handlePutStateStub.calledOnce).to.be.true;
                expect(handlePutStateStub.firstCall.args).to.deep.equal(['some collection', 'some key', {some :'value'}, 'dummyChannelId', 'dummyTxid']);
            });
        });

        describe('deletePrivateData', () => {
            let handleDeleteStateStub;
            let stub;

            beforeEach(() => {
                handleDeleteStateStub = sinon.stub().resolves('some state');
                stub = new Stub({
                    handleDeleteState: handleDeleteStateStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
            });

            it ('should throw an error if no arguments supplied', async () => {
                const result = stub.deletePrivateData();
                await expect(result).to.eventually.be.rejectedWith(Error, 'collection must be a valid string');
            });

            it ('should throw an error if one argument supplied', async () => {
                const result = stub.deletePrivateData('some arg');
                await expect(result).to.eventually.be.rejectedWith(Error, 'key must be a valid string');
            });

            it ('should throw an error if collection null', async () => {
                const result = stub.deletePrivateData(null, 'some key');
                await expect(result).to.eventually.be.rejectedWith(Error, 'collection must be a valid string');
            });

            it ('should return handler.handleDeleteState', async () => {
                const result = await stub.deletePrivateData('some collection', 'some key');

                expect(result).to.deep.equal('some state');
                expect(handleDeleteStateStub.calledOnce).to.be.true;
                expect(handleDeleteStateStub.firstCall.args).to.deep.equal(['some collection', 'some key', 'dummyChannelId', 'dummyTxid']);
            });
        });

        describe('setPrivateDataValidationParameter', () => {
            it('should return handler.handlePutStateMetadata', async () => {
                const handlePutStateMetadataStub = sinon.stub().resolves('nothing');
                const stub = new Stub({
                    handlePutStateMetadata: handlePutStateMetadataStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
                const ep = Buffer.from('someEndorsementPolicy');

                const nothing = await stub.setPrivateDataValidationParameter('a collection', 'aKey', ep);
                expect(nothing).to.deep.equal('nothing');
                sinon.assert.calledOnce(handlePutStateMetadataStub);
                sinon.assert.calledWith(handlePutStateMetadataStub, 'a collection', 'aKey', 'VALIDATION_PARAMETER', ep, 'dummyChannelId', 'dummyTxid');
            });
        });

        describe('getPrivateDataValidationParameter', () => {
            it('should return handler.handleGetStateMetadata', async () => {
                const handleGetStateMetadataStub = sinon.stub().resolves({VALIDATION_PARAMETER: 'some metadata'});
                const stub = new Stub({
                    handleGetStateMetadata: handleGetStateMetadataStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
                const ep = await stub.getPrivateDataValidationParameter('a collection', 'aKey');
                expect(ep).to.deep.equal('some metadata');
                sinon.assert.calledOnce(handleGetStateMetadataStub);
                sinon.assert.calledWith(handleGetStateMetadataStub, 'a collection', 'aKey', 'dummyChannelId', 'dummyTxid');
            });
        });

        describe('getPrivateDataByRange', () => {
            let handleGetStateByRangeStub;
            let stub;

            beforeEach(() => {
                handleGetStateByRangeStub = sinon.stub().resolves('some state');
                stub = new Stub({
                    handleGetStateByRange: handleGetStateByRangeStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
            });

            it ('should throw an error if no arguments supplied', async () => {
                const result = stub.getPrivateDataByRange();
                await expect(result).to.eventually.be.rejectedWith(Error, 'getPrivateDataByRange requires three arguments, collection, startKey and endKey');
            });

            it ('should throw an error if one argument supplied', async () => {
                const result = stub.getPrivateDataByRange('some arg');
                await expect(result).to.eventually.be.rejectedWith(Error, 'getPrivateDataByRange requires three arguments, collection, startKey and endKey');
            });

            it ('should throw an error if two arguments supplied', async () => {
                const result = stub.getPrivateDataByRange('some arg1', 'some arg2');
                await expect(result).to.eventually.be.rejectedWith(Error, 'getPrivateDataByRange requires three arguments, collection, startKey and endKey');
            });

            it ('should throw an error if collection null', async () => {
                const result = stub.getPrivateDataByRange(null, 'some start key', 'some end key');
                await expect(result).to.eventually.be.rejectedWith(Error, 'collection must be a valid string');
            });

            it ('should use a substitute start key if none provided', async () => {
                const EMPTY_KEY_SUBSTITUTE = Stub.__get__('EMPTY_KEY_SUBSTITUTE');

                const result = await stub.getPrivateDataByRange('some collection', null, 'some end key');

                expect(result).to.deep.equal('some state');
                expect(handleGetStateByRangeStub.calledOnce).to.be.true;
                expect(handleGetStateByRangeStub.firstCall.args).to.deep.equal(['some collection', EMPTY_KEY_SUBSTITUTE, 'some end key', 'dummyChannelId', 'dummyTxid']);
            });

            it ('should return handler.handleGetStateByRange', async () => {
                const result = await stub.getPrivateDataByRange('some collection', 'some start key', 'some end key');

                expect(result).to.deep.equal('some state');
                expect(handleGetStateByRangeStub.calledOnce).to.be.true;
                expect(handleGetStateByRangeStub.firstCall.args).to.deep.equal(['some collection', 'some start key', 'some end key', 'dummyChannelId', 'dummyTxid']);
            });
        });

        describe('getPrivateDataByPartialCompositeKey', () => {
            let stub;

            beforeEach(() => {
                stub = new Stub('dummyClient', 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
            });

            it ('should throw an error if no arguments supplied', async () => {
                const result = stub.getPrivateDataByPartialCompositeKey();
                await expect(result).to.eventually.be.rejectedWith(Error, 'getPrivateDataByPartialCompositeKey requires three arguments, collection, objectType and attributes');
            });

            it ('should throw an error if one argument supplied', async () => {
                const result = stub.getPrivateDataByPartialCompositeKey('some arg');
                await expect(result).to.eventually.be.rejectedWith(Error, 'getPrivateDataByPartialCompositeKey requires three arguments, collection, objectType and attributes');
            });

            it ('should throw an error if two arguments supplied', async () => {
                const result = stub.getPrivateDataByPartialCompositeKey('some arg1', 'some arg2');
                await expect(result).to.eventually.be.rejectedWith(Error, 'getPrivateDataByPartialCompositeKey requires three arguments, collection, objectType and attributes');
            });

            it ('should throw an error if collection null', async () => {
                const result = stub.getPrivateDataByPartialCompositeKey(null, 'some type', ['arg1', 'arg2']);
                await expect(result).to.eventually.be.rejectedWith(Error, 'collection must be a valid string');
            });

            it ('should return stub.getPrivateDataByRange', async () => {
                const MAX_UNICODE_RUNE_VALUE = Stub.__get__('MAX_UNICODE_RUNE_VALUE');

                const createCompositeKeyStub = sinon.stub(stub, 'createCompositeKey').returns('some composite key');
                const getPrivateDataByRangeStub = sinon.stub(stub, 'getPrivateDataByRange').resolves('some data by range');

                const result = await stub.getPrivateDataByPartialCompositeKey('some collection', 'some type', ['arg1', 'arg2']);

                expect(result).to.deep.equal('some data by range');
                expect(createCompositeKeyStub.calledOnce).to.be.true;
                expect(createCompositeKeyStub.firstCall.args).to.deep.equal(['some type', ['arg1', 'arg2']]);
                expect(getPrivateDataByRangeStub.calledOnce).to.be.true;
                expect(getPrivateDataByRangeStub.firstCall.args).to.deep.equal(['some collection', 'some composite key', `some composite key${MAX_UNICODE_RUNE_VALUE}`]);
            });
        });

        describe('getPrivateDataQueryResult', () => {
            let handleGetQueryResultStub;
            let stub;

            beforeEach(() => {
                handleGetQueryResultStub = sinon.stub().resolves('some query result');
                stub = new Stub({
                    handleGetQueryResult: handleGetQueryResultStub
                }, 'dummyChannelId', 'dummyTxid', {
                    args: []
                });
            });

            it ('should throw an error if no arguments supplied', async () => {
                const result = stub.getPrivateDataQueryResult();
                await expect(result).to.eventually.be.rejectedWith(Error, 'getPrivateDataQueryResult requires two arguments, collection and query');
            });

            it ('should throw an error if one argument supplied', async () => {
                const result = stub.getPrivateDataQueryResult('some arg');
                await expect(result).to.eventually.be.rejectedWith(Error, 'getPrivateDataQueryResult requires two arguments, collection and query');
            });

            it ('should throw an error if collection null', async () => {
                const result = stub.getPrivateDataQueryResult(null, 'some query');
                await expect(result).to.eventually.be.rejectedWith(Error, 'collection must be a valid string');
            });

            it ('should return handler.handleGetQueryResult', async () => {
                const result = await stub.getPrivateDataQueryResult('some collection', 'some query');

                expect(result).to.deep.equal('some query result');
                expect(handleGetQueryResultStub.calledOnce).to.be.true;
                expect(handleGetQueryResultStub.firstCall.args).to.deep.equal(['some collection', 'some query', null, 'dummyChannelId', 'dummyTxid']);
            });
        });
    });
});
