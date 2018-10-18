/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
/* global describe it beforeEach afterEach */
'use strict';

const sinon = require('sinon');
const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const rewire = require('rewire');
const Iterator = rewire('../../../fabric-shim/lib/iterators.js');
const StateQueryIterator = Iterator.StateQueryIterator;
const HistoryQueryIterator = Iterator.HistoryQueryIterator;
const handler = require('../../../fabric-shim/lib/handler.js');

const channel_id = 'theChannelId';
const txID = 'aTx';

describe('Iterator', () => {
    let mockHandler;
    let mockResponse;

    beforeEach(() => {
        mockHandler = sinon.createStubInstance(handler);
        mockResponse = {};
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
                mockResponse.id = 1;
                mockHandler.handleQueryStateClose = sinon.stub().resolves('some resolution');

                const ci = new CommonIterator(mockHandler, channel_id, txID, mockResponse, 'some type');

                const result = await ci.close();

                expect(result).to.deep.equal('some resolution');
                expect(mockHandler.handleQueryStateClose.calledOnce).to.be.ok;
                expect(mockHandler.handleQueryStateClose.firstCall.args).to.deep.equal([mockResponse.id, channel_id, txID]);
            });
        });

        describe('_getResultFromBytes', () => {

            const QRProto = Iterator.__get__('_queryresultProto');
            QRProto.KV.decode = sinon.stub().returns('decoded KV');
            QRProto.KeyModification.decode = sinon.stub().returns('decoded Keymodification');

            it ('should return KV decode on resultbytes for a QUERY type', () => {
                const ci = new CommonIterator(mockHandler, channel_id, txID, mockResponse, 'QUERY');

                const result = ci._getResultFromBytes({resultBytes: 'some bytes'});

                expect(result).to.deep.equal('decoded KV');
            });

            it ('should return KeyModification decode on resultbytes for a HISTORY type', () => {
                const ci = new CommonIterator(mockHandler, channel_id, txID, mockResponse, 'HISTORY');

                const result = ci._getResultFromBytes({resultBytes: 'some bytes'});

                expect(result).to.equal('decoded Keymodification');
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

            it ('should return value of first element of results converted from bytes and done true when has_more false and results has no more elements after currentLoc', () => {
                mockResponse.results = ['some result bytes'];
                mockResponse.has_more = false;

                const result = ci._createAndEmitResult();

                expect(getResultFromBytesStub.calledOnce).to.be.ok;
                expect(getResultFromBytesStub.firstCall.args).to.deep.equal(['some result bytes']);
                expect(result).to.deep.equal({
                    value: 'some result',
                    done: true
                });
            });

            it ('should return value of first element of results converted from bytes and done true when has_more true and results has no more elements after currentLoc', () => {
                mockResponse.results = ['some result bytes'];
                mockResponse.has_more = true;

                const result = ci._createAndEmitResult();

                expect(getResultFromBytesStub.calledOnce).to.be.ok;
                expect(getResultFromBytesStub.firstCall.args).to.deep.equal(['some result bytes']);
                expect(ci.currentLoc).to.deep.equal(1);
                expect(result).to.deep.equal({
                    value: 'some result',
                    done: false
                });
            });

            it ('should return value of first element of results converted from bytes and done false when has_more false and results has elements after currentLoc', () => {
                mockResponse.results = ['some result bytes', 'some more result bytes'];
                mockResponse.has_more = false;

                const result = ci._createAndEmitResult();

                expect(getResultFromBytesStub.calledOnce).to.be.ok;
                expect(getResultFromBytesStub.firstCall.args).to.deep.equal(['some result bytes']);
                expect(ci.currentLoc).to.deep.equal(1);
                expect(result).to.deep.equal({
                    value: 'some result',
                    done: false
                });
            });

            it ('should return value of first element of results converted from bytes and done false when has_more true and results has elements after currentLoc', () => {
                mockResponse.results = ['some result bytes', 'some more result bytes'];
                mockResponse.has_more = true;

                const result = ci._createAndEmitResult();

                expect(getResultFromBytesStub.calledOnce).to.be.ok;
                expect(getResultFromBytesStub.firstCall.args).to.deep.equal(['some result bytes']);
                expect(ci.currentLoc).to.deep.equal(1);
                expect(result).to.deep.equal({
                    value: 'some result',
                    done: false
                });
            });

            it ('should return as expected with non-zero currentLoc', () => {
                mockResponse.results = ['some result bytes', 'some more result bytes'];
                mockResponse.has_more = true;

                ci.currentLoc = 1;

                const result = ci._createAndEmitResult();

                expect(getResultFromBytesStub.calledOnce).to.be.ok;
                expect(getResultFromBytesStub.firstCall.args).to.deep.equal(['some more result bytes']);
                expect(ci.currentLoc).to.deep.equal(2);
                expect(result).to.deep.equal({
                    value: 'some result',
                    done: false
                });
            });

            it ('should return value of first element of results converted from bytes and done false and emit', () => {
                mockResponse.results = ['some result bytes', 'some more result bytes'];
                mockResponse.has_more = false;

                const expectedResult = {
                    value: 'some result',
                    done: false
                };

                const emitStub = sinon.stub(ci, 'emit');
                const listenerCountStub = sinon.stub(ci, 'listenerCount').returns(1);

                const result = ci._createAndEmitResult();

                expect(getResultFromBytesStub.calledOnce).to.be.ok;
                expect(getResultFromBytesStub.firstCall.args).to.deep.equal(['some result bytes']);
                expect(ci.currentLoc).to.deep.equal(1);
                expect(result).to.deep.equal(expectedResult);
                expect(listenerCountStub.calledOnce).to.be.ok;
                expect(listenerCountStub.firstCall.args).to.deep.equal(['data']);
                expect(emitStub.calledOnce).to.be.ok;
                expect(emitStub.firstCall.args).to.deep.equal(['data', ci, expectedResult]);

                emitStub.restore();
                listenerCountStub.restore();
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
                mockResponse.results = ['some result bytes', 'some more result bytes'];

                const result = await ci.next();

                expect(result).to.deep.equal('some result');
            });

            it ('should return _createAndEmitResult when response has_more and no error occurs', async () => {
                mockResponse.results = [];
                mockResponse.has_more = true;

                const nextResponse = {
                    results: ['some result bytes', 'some more result bytes'],
                    has_more: false
                };

                mockHandler.handleQueryStateNext = sinon.stub().resolves(nextResponse);

                ci.currentLoc = 1;

                const result = await ci.next();

                expect(result).to.deep.equal('some result');
                expect(ci.currentLoc).to.deep.equal(0);
                expect(ci.response).to.deep.equal(nextResponse);
            });

            it ('should emit an error if error occurs when has_more and listenerCount for data > 0', async () => {
                mockResponse.results = [];
                mockResponse.has_more = true;

                const err = new Error('some error');

                mockHandler.handleQueryStateNext = sinon.stub().rejects(err);
                const emitStub = sinon.stub(ci, 'emit');
                const listenerCountStub = sinon.stub(ci, 'listenerCount').returns(1);

                ci.currentLoc = 1;

                const result = await ci.next();

                expect(result).to.be.undefined;
                expect(createAndEmitResultStub.notCalled).to.be.ok;
                expect(listenerCountStub.calledOnce).to.be.ok;
                expect(listenerCountStub.firstCall.args).to.deep.equal(['data']);
                expect(emitStub.calledOnce).to.be.ok;
                expect(emitStub.firstCall.args).to.deep.equal(['error', ci, err]);

                listenerCountStub.restore();
                emitStub.restore();
            });

            it ('should throw an error if error occurs when has_more and listenerCount for data = 0', async () => {
                mockResponse.results = [];
                mockResponse.has_more = true;

                const err = new Error('some error');

                mockHandler.handleQueryStateNext = sinon.stub().rejects(err);
                const emitStub = sinon.stub(ci, 'emit');
                const listenerCountStub = sinon.stub(ci, 'listenerCount').returns(0);

                ci.currentLoc = 1;

                const result = ci.next();

                await expect(result).to.eventually.be.rejected;
                expect(createAndEmitResultStub.notCalled).to.be.ok;
                expect(listenerCountStub.calledOnce).to.be.ok;
                expect(listenerCountStub.firstCall.args).to.deep.equal(['data']);
                expect(emitStub.notCalled).to.be.ok;

                listenerCountStub.restore();
                emitStub.restore();
            });

            it ('should return done and emit end if response does not has_more and listenerCount for end > 0', async () => {
                mockResponse.results = [];
                mockResponse.has_more = false;

                const emitStub = sinon.stub(ci, 'emit');
                const listenerCountStub = sinon.stub(ci, 'listenerCount').returns(1);

                const result = await ci.next();

                expect(result).to.deep.equal({done: true});
                expect(createAndEmitResultStub.notCalled).to.be.true;
                expect(listenerCountStub.calledOnce).to.be.ok;
                expect(listenerCountStub.firstCall.args).to.deep.equal(['end']);
                expect(emitStub.calledOnce).to.be.ok;
                expect(emitStub.firstCall.args).to.deep.equal(['end', ci]);
            });

            it ('should return done and not emit end if response does not has_more and listenerCount for end = 0', async () => {
                mockResponse.results = [];
                mockResponse.has_more = false;

                const emitStub = sinon.stub(ci, 'emit');
                const listenerCountStub = sinon.stub(ci, 'listenerCount').returns(0);

                const result = await ci.next();

                expect(result).to.deep.equal({done: true});
                expect(createAndEmitResultStub.notCalled).to.be.true;
                expect(listenerCountStub.calledOnce).to.be.ok;
                expect(listenerCountStub.firstCall.args).to.deep.equal(['end']);
                expect(emitStub.notCalled).to.be.ok;
            });
        });
    });

    describe('StateQueryIterator', () => {
        it ('should extend CommonIterator using QUERY for type', () => {
            const sqi = new StateQueryIterator(mockHandler, channel_id, txID, mockResponse);

            expect(sqi instanceof Iterator.__get__('CommonIterator')).to.be.ok;
            expect(sqi.type).to.deep.equal('QUERY');
        });
    });

    describe('HistoryQueryIterator', () => {
        it ('should extend CommonIterator using HISTORY for type', () => {
            const hqi = new HistoryQueryIterator(mockHandler, channel_id, txID, mockResponse);

            expect(hqi instanceof Iterator.__get__('CommonIterator')).to.be.ok;
            expect(hqi.type).to.deep.equal('HISTORY');
        });
    });
});
