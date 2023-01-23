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
const { ChaincodeMessageHandler } = require('../../../fabric-shim/lib/handler.js');
const google_protobuf_timestamp_pb = require('google-protobuf/google/protobuf/timestamp_pb');

const { ledger } = require('@hyperledger/fabric-protos');

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

        it('should set the variables using the arguments in the constructor', () => {
            const ci = new CommonIterator(mockHandler, channel_id, txID, mockResponse, 'some type');

            expect(ci.type).to.deep.equal('some type');
            expect(ci.handler).to.deep.equal(mockHandler);
            expect(ci.channel_id).to.deep.equal(channel_id);
            expect(ci.txID).to.deep.equal(txID);
            expect(ci.response).to.deep.equal(mockResponse);
            expect(ci.currentLoc).to.deep.equal(0);
        });

        describe('close', () => {
            it('should return handler.handleQueryStateClose', async () => {
                mockResponse.getId = () => 1;
                mockHandler.handleQueryStateClose = sinon.stub().resolves('some resolution');

                const ci = new CommonIterator(mockHandler, channel_id, txID, mockResponse, 'some type');

                const result = await ci.close();

                expect(result).to.deep.equal('some resolution');

                expect(mockHandler.handleQueryStateClose.calledOnce).to.be.true;
                expect(mockHandler.handleQueryStateClose.firstCall.args).to.deep.equal([mockResponse.getId(), channel_id, txID]);
            });
        });

        describe('_createAndEmitResult', () => {
            let ci;
            let getResultBytesQuery;
            let getResultBytesHistory;
            let queryResult;
            let historyResult;
            let timestampStub;
            let getResultbytes;

            beforeEach(() => {
                ci = new CommonIterator(mockHandler, channel_id, txID, mockResponse, 'QUERY');
                queryResult = sandbox.createStubInstance(ledger.queryresult.KV);
                historyResult = sandbox.createStubInstance(ledger.queryresult.KeyModification);
                timestampStub = sandbox.createStubInstance(google_protobuf_timestamp_pb.Timestamp);
                getResultbytes = sinon.stub();


                // queryResult.getTimestamp.returns(timestampStub);
                timestampStub.toObject.returns({ seconds: 0, nanos: 0 });
                queryResult.getValue.returns('hello');
                queryResult.getKey.returns('fred');
                historyResult.getValue.returns('hello');
                historyResult.getTxId.returns('0xCAFE');
                historyResult.getIsDelete.returns(true);
                historyResult.getTimestamp.returns(timestampStub);
                getResultBytesQuery = sinon.stub(ledger.queryresult.KV, 'deserializeBinary').returns(queryResult);
                getResultBytesHistory = sinon.stub(ledger.queryresult.KeyModification, 'deserializeBinary').returns(historyResult);
            });

            afterEach(() => {
                getResultBytesQuery.restore();
                getResultBytesHistory.restore();
            });

            it('should return value from query API', () => {
                mockResponse.getResultsList = () => [{ getResultbytes }];
                const result = ci._createAndEmitResult();

                expect(getResultBytesQuery.calledOnce).to.be.true;
                expect(result).to.deep.equal({
                    value: {
                        key: 'fred',
                        value: Buffer.from('hello')
                    },
                    done: false
                });
            });

            it('should return value from history API', () => {

                mockResponse.getResultsList = () => [{ getResultbytes }];
                ci.type = 'HISTORY';
                const result = ci._createAndEmitResult();

                expect(getResultBytesHistory.calledOnce).to.be.true;
                expect(ci.currentLoc).to.deep.equal(1);
                expect(result).to.deep.equal({
                    value: {
                        value: Buffer.from('hello'),
                        isDelete: true,
                        timestamp: {nanos:0, seconds:0},
                        txId:'0xCAFE'
                    },
                    done: false
                });
            });

            it('should return error from history API', () => {

                mockResponse.getResultsList = () => [{ getResultbytes }];
                ci.type = 'WIBBLE';
                expect(()=>{ci._createAndEmitResult();}).to.throw(/Iterator constructed with unknown type/);
            });

        });

        describe('next', () => {
            let ci;
            let createAndEmitResultStub;

            beforeEach(() => {
                ci = new CommonIterator(mockHandler, channel_id, txID, mockResponse, 'QUERY');
                createAndEmitResultStub = sinon.stub(ci, '_createAndEmitResult').returns('some result');
            });

            afterEach(() => {
                createAndEmitResultStub.restore();
            });

            it('should return _createAndEmitResult when there are elements left in the result set', async () => {
                mockResponse.getResultsList = () => ['some result bytes', 'some more result bytes'];

                const result = await ci.next();

                expect(result).to.deep.equal('some result');
            });

            it('should return _createAndEmitResult when response hasMore and no error occurs', async () => {
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

            it('should throw an error if error occurs when hasMore and listenerCount for data = 0', async () => {
                mockResponse.getResultsList = () => [];
                mockResponse.getHasMore = () => true;

                const err = new Error('some error');

                mockHandler.handleQueryStateNext = sinon.stub().rejects(err);

                ci.currentLoc = 1;

                const result = ci.next();

                await expect(result).to.eventually.be.rejected;
                expect(createAndEmitResultStub.notCalled).to.be.true;
            });

            it('should return done if response does not hasMore and listenerCount for end > 0', async () => {
                mockResponse.getResultsList = () => [];
                mockResponse.getHasMore = () => false;

                const result = await ci.next();

                expect(result).to.deep.equal({ done: true });
                expect(createAndEmitResultStub.notCalled).to.be.true;
            });

            it('should return done if response does not hasMore and listenerCount for end = 0', async () => {
                mockResponse.getResultsList = () => [];
                mockResponse.getHasMore = () => false;

                const result = await ci.next();

                expect(result).to.deep.equal({ done: true });
                expect(createAndEmitResultStub.notCalled).to.be.true;
            });
        });
    });

    describe('StateQueryIterator', () => {
        it('should extend CommonIterator using QUERY for type', () => {
            const sqi = new StateQueryIterator(mockHandler, channel_id, txID, mockResponse);

            expect(sqi instanceof Iterator.__get__('CommonIterator')).to.be.true;
            expect(sqi.type).to.deep.equal('QUERY');
        });
    });

    describe('HistoryQueryIterator', () => {
        it('should extend CommonIterator using HISTORY for type', () => {
            const hqi = new HistoryQueryIterator(mockHandler, channel_id, txID, mockResponse);

            expect(hqi instanceof Iterator.__get__('CommonIterator')).to.be.true;
            expect(hqi.type).to.deep.equal('HISTORY');
        });
    });
});
