/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
/* global  */
'use strict';

const sinon = require('sinon');
const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const rewire = require('rewire');
const Iterator = rewire('../../../fabric-shim/lib/iterators.js');
const StateQueryIterator = Iterator.StateQueryIterator;
const HistoryQueryIterator = Iterator.HistoryQueryIterator;
const {ChaincodeMessageHandler} = require('../../../fabric-shim/lib/handler.js');


const {ledger} = require('@hyperledger/fabric-protos');
const channel_id = 'theChannelId';
const txID = 'aTx';

describe('Iterator', () => {
    let mockHandler;
    let mockResponse;
    let sandbox;
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockHandler = sandbox.createStubInstance(ChaincodeMessageHandler);
        mockResponse = {};
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('CommonIterator', () => {
        const CommonIterator = Iterator.__get__('CommonIterator');

        it ('should set the variables using the arguments in the constructor', () => {
            const ci = new CommonIterator(mockHandler, channel_id, txID, mockResponse, 'some type');

            expect(ci.type).to.deep.equal('some type');
            expect(ci.handler).to.deep.equal(mockHandler);
            expect(ci.channel_id).to.deep.equal(channel_id);
            expect(ci.txID).to.deep.equal(txID);
            expect(ci.response).to.deep.equal(mockResponse);
            expect(ci.currentLoc).to.deep.equal(0);
        });

        describe('close', () => {
            it ('should return handler.handleQueryStateClose', async () => {
                mockResponse.getId = () => 1;
                mockHandler.handleQueryStateClose = sinon.stub().resolves('some resolution');

                const ci = new CommonIterator(mockHandler, channel_id, txID, mockResponse, 'some type');

                const result = await ci.close();

                expect(result).to.deep.equal('some resolution');

                expect(mockHandler.handleQueryStateClose.calledOnce).to.be.true;
                expect(mockHandler.handleQueryStateClose.firstCall.args).to.deep.equal([mockResponse.getId(), channel_id, txID]);
            });
        });

        describe('_getResultFromBytes', () => {

            it ('should return KV decode on resultbytes for a QUERY type', () => {
                const ci = new CommonIterator(mockHandler, channel_id, txID, mockResponse, 'QUERY');

                const bytes = new ledger.queryresult.KV();
                bytes.setValue('some bytes');
                const result = ci._getResultFromBytes({getResultbytes:() => bytes.serializeBinary()});
                expect(result).is.not.null;
            });

            it ('should return KeyModification decode on resultbytes for a HISTORY type', () => {
                const ci = new CommonIterator(mockHandler, channel_id, txID, mockResponse, 'HISTORY');

                const bytes = new ledger.queryresult.KeyModification();
                bytes.setValue('some bytes');

                const result = ci._getResultFromBytes({getResultbytes:() => bytes.serializeBinary()});
                expect(result).is.not.null;
            });

            it ('should throw an error for unknown types', () => {
                const ci = new CommonIterator(mockHandler, channel_id, txID, mockResponse, 'some type');

                expect(() => {
                    ci._getResultFromBytes({resultBytes: 'some bytes'});
                }).to.throw(/Iterator constructed with unknown type: some type/);
            });
        });

        describe('_createAndEmitResult', () => {
            let ci;
            let getResultFromBytesStub;

            beforeEach(() => {
                ci = new CommonIterator(mockHandler, channel_id, txID, mockResponse, 'QUERY');
                getResultFromBytesStub = sinon.stub(ci, '_getResultFromBytes').returns('some result');
            });

            afterEach(() => {
                getResultFromBytesStub.restore();
            });

            it ('should return value of first element of results converted from bytes and done false when hasMore false and results has no more elements after currentLoc', () => {
                mockResponse.getResultsList = () => ['some result bytes'];
                mockResponse.getHasMore = () => false;
                getResultFromBytesStub.returns({getKey:() => 'akey', getValue:() => 'some result'});

                const result = ci._createAndEmitResult();

                expect(getResultFromBytesStub.calledOnce).to.be.true;
                expect(getResultFromBytesStub.firstCall.args).to.deep.equal(['some result bytes']);
                expect(result).to.deep.equal({
                    value: {value:Buffer.from('some result'),
                        key: 'akey'},
                    done: false
                });
            });

            it ('should return value of first element of results converted from bytes and done false when hasMore true and results has no more elements after currentLoc', () => {
                mockResponse.getResultsList = () => ['some result bytes'];
                mockResponse.getHasMore = () => true;
                getResultFromBytesStub.returns({getKey:() => 'akey', getValue:() => 'some result'});

                const result = ci._createAndEmitResult();

                expect(getResultFromBytesStub.calledOnce).to.be.true;
                expect(getResultFromBytesStub.firstCall.args).to.deep.equal(['some result bytes']);
                expect(ci.currentLoc).to.deep.equal(1);
                expect(result).to.deep.equal({
                    value: {value:Buffer.from('some result'), key: 'akey'},
                    done: false,

                });
            });

            it ('should return value of first element of results converted from bytes and done false when hasMore false and results has elements after currentLoc', () => {
                mockResponse.getResultsList = () => ['some result bytes', 'some more result bytes'];
                mockResponse.getHasMore = () => false;
                getResultFromBytesStub.returns({getKey:() => 'akey', getValue:() => 'some result'});

                const result = ci._createAndEmitResult();

                expect(getResultFromBytesStub.calledOnce).to.be.true;
                expect(getResultFromBytesStub.firstCall.args).to.deep.equal(['some result bytes']);
                expect(ci.currentLoc).to.deep.equal(1);
                expect(result).to.deep.equal({
                    value: {value:Buffer.from('some result'),
                        key: 'akey'},
                    done: false
                });
            });

            it ('should return value of first element of results converted from bytes and done false when hasMore true and results has elements after currentLoc', () => {
                mockResponse.getResultsList = () => ['some result bytes', 'some more result bytes'];
                mockResponse.getHasMore = () => true;

                getResultFromBytesStub.returns({getKey:() => 'akey', getValue:() => 'some result'});


                const result = ci._createAndEmitResult();

                expect(getResultFromBytesStub.calledOnce).to.be.true;
                expect(getResultFromBytesStub.firstCall.args).to.deep.equal(['some result bytes']);
                expect(ci.currentLoc).to.deep.equal(1);
                expect(result).to.deep.equal({
                    value: {value: Buffer.from('some result'),
                        key: 'akey'},
                    done: false
                });
            });

            it ('should return as expected with non-zero currentLoc', () => {
                mockResponse.getResultsList = () => ['some result bytes', 'some more result bytes'];
                mockResponse.getHasMore = () => true;

                ci.currentLoc = 1;

                getResultFromBytesStub.returns({getKey:() => 'akey', getValue:() => 'some result'});


                const result = ci._createAndEmitResult();

                expect(getResultFromBytesStub.calledOnce).to.be.true;
                expect(getResultFromBytesStub.firstCall.args).to.deep.equal(['some more result bytes']);
                expect(ci.currentLoc).to.deep.equal(2);
                expect(result).to.deep.equal({
                    value: {value:Buffer.from('some result'),
                        key: 'akey'},
                    done: false
                });
            });

            it('should return value of first element of results converted from bytes and done false', () => {
                mockResponse.getResultsList = () => ['some result bytes', 'some more result bytes'];
                mockResponse.getHasMore = () => false;

                const expectedResult = {
                    value: {value: Buffer.from('some result'),
                        key: 'akey'},
                    done: false
                };

                getResultFromBytesStub.returns({getKey:() => 'akey', getValue:() => 'some result'});

                const result = ci._createAndEmitResult();

                expect(getResultFromBytesStub.calledOnce).to.be.true;
                expect(getResultFromBytesStub.firstCall.args).to.deep.equal(['some result bytes']);
                expect(ci.currentLoc).to.deep.equal(1);
                expect(result).to.deep.equal(expectedResult);
            });
        });

        describe('next', () => {
            let ci;
            let createAndEmitResultStub;

            beforeEach(() => {
                ci = new CommonIterator(mockHandler, channel_id, txID, mockResponse, 'QUERY');
                createAndEmitResultStub =  sinon.stub(ci, '_createAndEmitResult').returns('some result');
            });

            afterEach(() => {
                createAndEmitResultStub.restore();
            });

            it ('should return _createAndEmitResult when there are elements left in the result set', async () => {
                mockResponse.getResultsList = () => ['some result bytes', 'some more result bytes'];

                const result = await ci.next();

                expect(result).to.deep.equal('some result');
            });

            it ('should return _createAndEmitResult when response hasMore and no error occurs', async () => {
                mockResponse.getResultsList = () => [];
                mockResponse.getHasMore = () => true;
                mockResponse.getId = () => 1;

                const nextResponse = {
                    getResultsList: () => ['some result bytes', 'some more result bytes'],
                    getHasMore: () => false,
                    getId: () => 1
                };

                mockHandler.handleQueryStateNext = sinon.stub().resolves(nextResponse);

                ci.currentLoc = 1;

                const result = await ci.next();

                expect(result).to.deep.equal('some result');
                expect(ci.currentLoc).to.deep.equal(0);
                expect(ci.response).to.deep.equal(nextResponse);
            });

            it ('should throw an error if error occurs when hasMore and listenerCount for data = 0', async () => {
                mockResponse.getResultsList = () => [];
                mockResponse.getHasMore = () => true;

                const err = new Error('some error');

                mockHandler.handleQueryStateNext = sinon.stub().rejects(err);

                ci.currentLoc = 1;

                const result = ci.next();

                await expect(result).to.eventually.be.rejected;
                expect(createAndEmitResultStub.notCalled).to.be.true;
            });

            it ('should return done if response does not hasMore and listenerCount for end > 0', async () => {
                mockResponse.getResultsList = () => [];
                mockResponse.getHasMore = () => false;

                const result = await ci.next();

                expect(result).to.deep.equal({done: true});
                expect(createAndEmitResultStub.notCalled).to.be.true;
            });

            it ('should return done if response does not hasMore and listenerCount for end = 0', async () => {
                mockResponse.getResultsList = () => [];
                mockResponse.getHasMore = () => false;

                const result = await ci.next();

                expect(result).to.deep.equal({done: true});
                expect(createAndEmitResultStub.notCalled).to.be.true;
            });
        });
    });

    describe('StateQueryIterator', () => {
        it ('should extend CommonIterator using QUERY for type', () => {
            const sqi = new StateQueryIterator(mockHandler, channel_id, txID, mockResponse);

            expect(sqi instanceof Iterator.__get__('CommonIterator')).to.be.true;
            expect(sqi.type).to.deep.equal('QUERY');
        });
    });

    describe('HistoryQueryIterator', () => {
        it ('should extend CommonIterator using HISTORY for type', () => {
            const hqi = new HistoryQueryIterator(mockHandler, channel_id, txID, mockResponse);

            expect(hqi instanceof Iterator.__get__('CommonIterator')).to.be.true;
            expect(hqi.type).to.deep.equal('HISTORY');
        });
    });
});
