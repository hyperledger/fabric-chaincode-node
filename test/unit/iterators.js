/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const test = require('../base.js');
const sinon = require('sinon');
const rewire = require('rewire');
const Iterator = rewire('fabric-shim/lib/iterators.js');
const StateQueryIterator = Iterator.StateQueryIterator;
const HistoryQueryIterator = Iterator.HistoryQueryIterator;
const handler = require('fabric-shim/lib/handler.js');

test('Iterator constructor tests', (t) => {
	let mockHandler = sinon.createStubInstance(handler);
	let historyQI = new HistoryQueryIterator(mockHandler, 'mychannel', 'tx1', 'somebytes');
	let queryQI = new StateQueryIterator(mockHandler, 'mychannel', 'tx2', 'someotherbytes');
	t.equal(historyQI.type, 'HISTORY', 'Test History iterator construction');
	t.equal(historyQI.handler, mockHandler, 'Test History iterator construction');
	t.equal(historyQI.txID, 'tx1', 'Test History iterator construction');
	t.equal(historyQI.channel_id, 'mychannel', 'Test History iterator construction');
	t.equal(historyQI.response, 'somebytes', 'Test History iterator construction');

	t.equal(queryQI.type, 'QUERY', 'Test Query iterator construction');
	t.equal(queryQI.handler, mockHandler, 'Test Query iterator construction');
	t.equal(queryQI.txID, 'tx2', 'Test Query iterator construction');
	t.equal(queryQI.channel_id, 'mychannel', 'Test History iterator construction');
	t.equal(queryQI.response, 'someotherbytes', 'Test Query iterator construction');
	t.end();
});

test('next: Empty response', async (t) => {
	let mockHandler = sinon.createStubInstance(handler);
	const emptyResponse = {
		results: [],
		has_more: false
	};

	let historyQI = new HistoryQueryIterator(mockHandler, 'mychannel', 'tx1', emptyResponse);
	historyQI.on('end', () => {});
	let queryQI = new StateQueryIterator(mockHandler, 'mychannel', 'tx2', emptyResponse);
	queryQI.on('end', ()=>{});
	let historyEmitStub = sinon.stub(historyQI, 'emit');
	let queryEmitStub = sinon.stub(queryQI, 'emit');

	let result = {done: false};
	while (!result.done) {
		result = await historyQI.next();
	}
	t.equal(historyEmitStub.calledOnce, true, 'Test history end emitted');
	t.deepEqual(historyEmitStub.firstCall.args, ['end', historyQI], 'Test history emit called with correct value');
	t.deepEqual(result, {done: true}, 'Test history returns correct value');

	result = {done: false};
	while (!result.done) {
		result = await queryQI.next();
	}
	t.equal(queryEmitStub.calledOnce, true, 'Test query end emitted');
	t.deepEqual(queryEmitStub.firstCall.args, ['end', queryQI], 'Test query emit called with correct value');
	t.deepEqual(result, {done: true}, 'Test query returns correct value');
});

test('next: Simple data 1st entry, no more', async (t) => {
	let mockHandler = sinon.createStubInstance(handler);
	const historyResponse = {
		results: ['history1', 'history2'],
		has_more: false
	};

	const queryResponse = {
		results: ['query1', 'query2'],
		has_more: false
	};

	let historyQI = new HistoryQueryIterator(mockHandler, 'mychannel', 'tx1', historyResponse);
	let queryQI = new StateQueryIterator(mockHandler, 'mychannel', 'tx2', queryResponse);
	let historyCreateStub = sinon.stub(historyQI, '_createAndEmitResult').returns({value: 'history1', done: false});
	let queryCreateStub = sinon.stub(queryQI, '_createAndEmitResult').returns({value: 'query1', done: false});

	let result = await historyQI.next();
	t.equal(historyCreateStub.calledOnce, true, 'Test history created and emitted');
	t.deepEqual(result, {value: 'history1', done: false}, 'Test history returns correct value');
	result = await queryQI.next();
	t.equal(queryCreateStub.calledOnce, true, 'Test query created and emitted');
	t.deepEqual(result, {value: 'query1', done: false}, 'Test history returns correct value');
});

test('next: reached end, no more', async (t) => {
	let mockHandler = sinon.createStubInstance(handler);
	const historyResponse = {
		id: 1,
		results: ['history1', 'history2'],
		has_more: false

	};
	const queryResponse = {
		id: 2,
		results: ['query1', 'query2'],
		has_more: false
	};

	let historyQI = new HistoryQueryIterator(mockHandler, 'mychannel', 'tx1', historyResponse);
	let queryQI = new StateQueryIterator(mockHandler, 'mychannel', 'tx2', queryResponse);
	let historyCreateStub = sinon.stub(historyQI, '_createAndEmitResult').returns({value: 'history1', done: false});
	let queryCreateStub = sinon.stub(queryQI, '_createAndEmitResult').returns({value: 'query1', done: false});
	historyQI.currentLoc = 2;
	queryQI.currentLoc = 2;

	let result = await historyQI.next();
	t.equal(historyCreateStub.callCount, 0, 'Test history created and emitted never called');
	t.deepEqual(result, {done: true}, 'Test history returns correct value');
	result = await queryQI.next();
	t.equal(queryCreateStub.callCount, 0, 'Test query created and emitted never called');
	t.deepEqual(result, {done: true}, 'Test query returns correct value');
});

test('next: reached end, has more', async (t) => {
	let mockHandlerHistory = sinon.createStubInstance(handler);
	let mockHandlerQuery = sinon.createStubInstance(handler);
	const historyResponse1 = {
		id: 2,
		results: ['history1', 'history2'],
		has_more: true

	};
	const queryResponse1 = {
		id: 3,
		results: ['query1', 'query2'],
		has_more: true
	};

	const historyResponse2 = {
		id: 2,
		results: ['history3'],
		has_more: false

	};
	const queryResponse2 = {
		id: 3,
		results: ['query3'],
		has_more: false
	};


	let historyQI = new HistoryQueryIterator(mockHandlerHistory, 'mychannel', 'tx1', historyResponse1);
	let queryQI = new StateQueryIterator(mockHandlerQuery, 'mychannel', 'tx2', queryResponse1);
	let historyCreateStub = sinon.stub(historyQI, '_createAndEmitResult').returns({value: 'history3', done: false});
	let queryCreateStub = sinon.stub(queryQI, '_createAndEmitResult').returns({value: 'query3', done: false});
	mockHandlerHistory.handleQueryStateNext.resolves(historyResponse2);
	mockHandlerQuery.handleQueryStateNext.resolves(queryResponse2);
	historyQI.currentLoc = 2;
	queryQI.currentLoc = 2;

	let result = await historyQI.next();
	t.equal(mockHandlerHistory.handleQueryStateNext.calledOnce, true, 'Test history called handleQueryStateNext');
	t.deepEqual(mockHandlerHistory.handleQueryStateNext.firstCall.args, [2, 'mychannel', 'tx1']);
	t.equal(historyQI.currentLoc, 0, 'Test history current location is reset');
	t.deepEqual(historyQI.response, historyResponse2, 'Test history response is stored');
	t.equal(historyCreateStub.calledOnce, true, 'Test history created and emitted');
	t.deepEqual(result, {value: 'history3', done: false}, 'Test history returns correct value');
	result = await queryQI.next();
	t.deepEqual(mockHandlerQuery.handleQueryStateNext.firstCall.args, [3, 'mychannel', 'tx2']);
	t.equal(mockHandlerQuery.handleQueryStateNext.calledOnce, true, 'Test query called handleQueryStateNext');
	t.equal(queryQI.currentLoc, 0, 'Test query current location is reset');
	t.deepEqual(queryQI.response, queryResponse2, 'Test query response is stored');
	t.equal(queryCreateStub.calledOnce, true, 'Test query created and emitted');
	t.deepEqual(result, {value: 'query3', done: false}, 'Test query returns correct value');
});

test('next: reached end, getting more throws error, handling via event emitters', async (t) => {
	let mockHandlerHistory = sinon.createStubInstance(handler);
	let mockHandlerQuery = sinon.createStubInstance(handler);
	const historyResponse1 = {
		id: 2,
		results: ['history1', 'history2'],
		has_more: true

	};
	const queryResponse1 = {
		id: 3,
		results: ['query1', 'query2'],
		has_more: true
	};

	let historyQI = new HistoryQueryIterator(mockHandlerHistory, 'mychannel', 'tx1', historyResponse1);
	historyQI.on('data', () => {});
	historyQI.on('error', () => {});
	let queryQI = new StateQueryIterator(mockHandlerQuery, 'mychannel', 'tx2', queryResponse1);
	queryQI.on('data', () => {});
	queryQI.on('error', () => {});
	let historyEmitStub = sinon.stub(historyQI, 'emit');
	let queryEmitStub = sinon.stub(queryQI, 'emit');
	let historyError = new Error('1');
	let queryError = new Error('2');
	mockHandlerHistory.handleQueryStateNext.rejects(historyError);
	mockHandlerQuery.handleQueryStateNext.rejects(queryError);
	historyQI.currentLoc = 2;
	queryQI.currentLoc = 2;

	await historyQI.next();
	t.equal(mockHandlerHistory.handleQueryStateNext.calledOnce, true, 'Test history called handleQueryStateNext');
	t.deepEqual(mockHandlerHistory.handleQueryStateNext.firstCall.args, [2, 'mychannel', 'tx1']);
	t.equal(historyEmitStub.calledOnce, true, 'Test history error emitted');
	t.deepEqual(historyEmitStub.firstCall.args, ['error', historyQI, historyError], 'Test history error emit called with correct value');
	await queryQI.next();
	t.deepEqual(mockHandlerQuery.handleQueryStateNext.firstCall.args, [3, 'mychannel', 'tx2']);
	t.equal(mockHandlerQuery.handleQueryStateNext.calledOnce, true, 'Test query called handleQueryStateNext');
	t.equal(queryEmitStub.calledOnce, true, 'Test query error emitted');
	t.deepEqual(queryEmitStub.firstCall.args, ['error', queryQI, queryError], 'Test query error emit called with correct value');
});

test('next: reached end, getting more throws error, handling via promises', async (t) => {
	let mockHandlerHistory = sinon.createStubInstance(handler);
	let mockHandlerQuery = sinon.createStubInstance(handler);
	const historyResponse1 = {
		id: 2,
		results: ['history1', 'history2'],
		has_more: true

	};
	const queryResponse1 = {
		id: 3,
		results: ['query1', 'query2'],
		has_more: true
	};

	let historyQI = new HistoryQueryIterator(mockHandlerHistory, 'mychannel', 'tx1', historyResponse1);
	let queryQI = new StateQueryIterator(mockHandlerQuery, 'mychannel', 'tx2', queryResponse1);
	let historyEmitStub = sinon.stub(historyQI, 'emit');
	let queryEmitStub = sinon.stub(queryQI, 'emit');
	let historyError = new Error('1');
	let queryError = new Error('2');
	mockHandlerHistory.handleQueryStateNext.rejects(historyError);
	mockHandlerQuery.handleQueryStateNext.rejects(queryError);
	historyQI.currentLoc = 2;
	queryQI.currentLoc = 2;

	try {
		await historyQI.next();
		t.fail('History should have not got here');
	}
	catch(err) {
		t.equal(mockHandlerHistory.handleQueryStateNext.calledOnce, true, 'Test history called handleQueryStateNext');
		t.deepEqual(mockHandlerHistory.handleQueryStateNext.firstCall.args, [2, 'mychannel', 'tx1']);
		t.equal(historyEmitStub.callCount, 0, 'Test history no error emitted');
		t.deepEqual(err, historyError, 'Test history error emit called with correct value');
	}
	try {
		await queryQI.next();
		t.fail('Query should have not got here');
	}
	catch(err) {
		t.deepEqual(mockHandlerQuery.handleQueryStateNext.firstCall.args, [3, 'mychannel', 'tx2']);
		t.equal(mockHandlerQuery.handleQueryStateNext.calledOnce, true, 'Test query called handleQueryStateNext');
		t.equal(queryEmitStub.callCount, 0, 'Test query no error emitted');
		t.deepEqual(err, queryError, 'Test query error emit called with correct value');
	}
});


test('_createAndEmitResult: value creation and emission, not end', (t) => {
	const historyResponse1 = {
		id: 2,
		results: ['history1', 'history2'],
		has_more: true

	};
	const queryResponse1 = {
		id: 3,
		results: ['query1', 'query2'],
		has_more: true
	};

	let historyQI = new HistoryQueryIterator(null, 'mychannel', 'tx1', historyResponse1);
	historyQI.on('data', () => {});
	let queryQI = new StateQueryIterator(null, 'mychannel', 'tx2', queryResponse1);
	queryQI.on('data', () => {});
	let historyGetResultStub = sinon.stub(historyQI, '_getResultFromBytes').returns('history1');
	let queryGetResultStub = sinon.stub(queryQI, '_getResultFromBytes').returns('query1');
	let historyEmitStub = sinon.stub(historyQI, 'emit');
	let queryEmitStub = sinon.stub(queryQI, 'emit');

	t.deepEqual(historyQI._createAndEmitResult(), {value: 'history1', done: false}, 'Test history returned value is correct');
	t.equal(historyGetResultStub.calledOnce, true, 'Test history getResultFromBytes called once');
	t.deepEqual(historyGetResultStub.firstCall.args, ['history1'], 'Test history getResultFromBytes passed correct parameter');
	t.equal(historyEmitStub.calledOnce, true, 'Test history emit was called');
	t.deepEqual(historyEmitStub.firstCall.args, ['data', historyQI,{value: 'history1', done: false}], 'Test history emit was called with data');
	t.equal(historyQI.currentLoc, 1, 'Test history current location incremented');

	t.deepEqual(queryQI._createAndEmitResult(), {value: 'query1', done: false}, 'Test query returned value is correct');
	t.equal(queryGetResultStub.calledOnce, true, 'Test query getResultFromBytes called once');
	t.deepEqual(queryGetResultStub.firstCall.args, ['query1'], 'Test query getResultFromBytes passed correct parameter');
	t.equal(queryEmitStub.calledOnce, true, 'Test query emit was called');
	t.deepEqual(queryEmitStub.firstCall.args, ['data', queryQI,{value: 'query1', done: false}], 'Test query emit was called with data');
	t.equal(queryQI.currentLoc, 1, 'Test query current location incremented');

	t.end();
});

test('_createAndEmitResult: value creation and emission, last one but has more', (t) => {
	const historyResponse1 = {
		id: 2,
		results: ['history1', 'history2'],
		has_more: true

	};
	const queryResponse1 = {
		id: 3,
		results: ['query1', 'query2'],
		has_more: true
	};

	let historyQI = new HistoryQueryIterator(null, 'mychannel', 'tx1', historyResponse1);
	historyQI.on('data', () => {});
	let queryQI = new StateQueryIterator(null, 'mychannel', 'tx2', queryResponse1);
	queryQI.on('data', () => {});
	let historyGetResultStub = sinon.stub(historyQI, '_getResultFromBytes').returns('history2');
	let queryGetResultStub = sinon.stub(queryQI, '_getResultFromBytes').returns('query2');
	let historyEmitStub = sinon.stub(historyQI, 'emit');
	let queryEmitStub = sinon.stub(queryQI, 'emit');
	historyQI.currentLoc = 1;
	queryQI.currentLoc = 1;

	t.deepEqual(historyQI._createAndEmitResult(), {value: 'history2', done: false}, 'Test history returned value is correct');
	t.equal(historyGetResultStub.calledOnce, true, 'Test history getResultFromBytes called once');
	t.deepEqual(historyGetResultStub.firstCall.args, ['history2'], 'Test history getResultFromBytes passed correct parameter');
	t.equal(historyEmitStub.calledOnce, true, 'Test history emit was called');
	t.deepEqual(historyEmitStub.firstCall.args, ['data', historyQI,{value: 'history2', done: false}], 'Test history emit was called with data');
	t.equal(historyQI.currentLoc, 2, 'Test history current location incremented');

	t.deepEqual(queryQI._createAndEmitResult(), {value: 'query2', done: false}, 'Test query returned value is correct');
	t.equal(queryGetResultStub.calledOnce, true, 'Test query getResultFromBytes called once');
	t.deepEqual(queryGetResultStub.firstCall.args, ['query2'], 'Test query getResultFromBytes passed correct parameter');
	t.equal(queryEmitStub.calledOnce, true, 'Test query emit was called');
	t.deepEqual(queryEmitStub.firstCall.args, ['data', queryQI,{value: 'query2', done: false}], 'Test query emit was called with data');
	t.equal(queryQI.currentLoc, 2, 'Test query current location incremented');

	t.end();
});

test('_createAndEmitResult: value creation and emission, last one and no more', (t) => {
	const historyResponse1 = {
		id: 2,
		results: ['history1', 'history2'],
		has_more: false

	};
	const queryResponse1 = {
		id: 3,
		results: ['query1', 'query2'],
		has_more: false
	};

	let historyQI = new HistoryQueryIterator(null, 'mychannel', 'tx1', historyResponse1);
	historyQI.on('data', () => {});
	historyQI.on('end', () => {});
	let queryQI = new StateQueryIterator(null, 'mychannel', 'tx2', queryResponse1);
	queryQI.on('data', () => {});
	queryQI.on('end', () => {});
	let historyGetResultStub = sinon.stub(historyQI, '_getResultFromBytes').returns('history2');
	let queryGetResultStub = sinon.stub(queryQI, '_getResultFromBytes').returns('query2');
	let historyEmitStub = sinon.stub(historyQI, 'emit');
	let queryEmitStub = sinon.stub(queryQI, 'emit');
	historyQI.currentLoc = 1;
	queryQI.currentLoc = 1;

	t.deepEqual(historyQI._createAndEmitResult(), {value: 'history2', done: true}, 'Test history returned value is correct');
	t.equal(historyGetResultStub.calledOnce, true, 'Test history getResultFromBytes called once');
	t.deepEqual(historyGetResultStub.firstCall.args, ['history2'], 'Test history getResultFromBytes passed correct parameter');
	t.equal(historyEmitStub.calledOnce, true, 'Test history emit was called only once');
	t.deepEqual(historyEmitStub.firstCall.args, ['data', historyQI,{value: 'history2', done: true}], 'Test history emit was called with data');

	t.deepEqual(queryQI._createAndEmitResult(), {value: 'query2', done: true}, 'Test query returned value is correct');
	t.equal(queryGetResultStub.calledOnce, true, 'Test query getResultFromBytes called once');
	t.deepEqual(queryGetResultStub.firstCall.args, ['query2'], 'Test query getResultFromBytes passed correct parameter');
	t.equal(queryEmitStub.calledOnce, true, 'Test query emit was called only once');
	t.deepEqual(queryEmitStub.firstCall.args, ['data', queryQI,{value: 'query2', done: true}], 'Test query emit was called with data');

	t.end();
});

test('_getResultFromBytes', (t) => {
	let QRProto = Iterator.__get__('_queryresultProto');
	QRProto.KV.decode = sinon.stub().returns('decoded KV');
	QRProto.KeyModification.decode = sinon.stub().returns('decoded Keymodification');

	let historyQI = new HistoryQueryIterator();
	let queryQI = new StateQueryIterator();

	let queryRes = queryQI._getResultFromBytes({resultBytes:'query bytes'});
	t.equal(queryRes, 'decoded KV', 'Test the right bytes a returned');
	t.true(QRProto.KV.decode.calledOnce, 'Test KV Decode was called for query');
	t.equal(QRProto.KV.decode.firstCall.args[0], 'query bytes');

	let historyRes = historyQI._getResultFromBytes({resultBytes:'history bytes'});
	t.equal(historyRes, 'decoded Keymodification', 'Test the right bytes a returned');
	t.true(QRProto.KeyModification.decode.calledOnce, 'Test Keymodification Decode was called for query');
	t.equal(QRProto.KeyModification.decode.firstCall.args[0], 'history bytes');
	t.end();
});

test('close: Test close', async (t) => {
	const historyResponse = {
		id: 1,
		results: ['history1', 'history2'],
		has_more: false

	};
	const queryResponse = {
		id: 2,
		results: ['query1', 'query2'],
		has_more: false
	};

	let mockHandlerHistory = sinon.createStubInstance(handler);
	let mockHandlerQuery = sinon.createStubInstance(handler);
	let historyQI = new HistoryQueryIterator(mockHandlerHistory, 'mychannel', 'tx1', historyResponse);
	let queryQI = new StateQueryIterator(mockHandlerQuery, 'mychannel', 'tx2', queryResponse);
	mockHandlerHistory.handleQueryStateClose.resolves('something1');
	mockHandlerQuery.handleQueryStateClose.resolves('something2');
	let res = await historyQI.close();
	t.equal(res, 'something1', 'Test history close resolves to some data');
	t.equal(mockHandlerHistory.handleQueryStateClose.calledOnce, true, 'Test history calls handle querystateclose once');
	t.deepEqual(mockHandlerHistory.handleQueryStateClose.firstCall.args, [1, 'mychannel', 'tx1'], 'Test history calls handlestateclose with correct parameters');

	res = await queryQI.close();
	t.equal(res, 'something2', 'Test query close resolves to some data');
	t.equal(mockHandlerQuery.handleQueryStateClose.calledOnce, true, 'Test query calls handle querystateclose once');
	t.deepEqual(mockHandlerQuery.handleQueryStateClose.firstCall.args, [2, 'mychannel', 'tx2'], 'Test query calls handlestateclose with correct parameters');
	t.end();
});

test('Integration tests for iterators using event emitters', async (t) => {
	let mockHandlerHistory = sinon.createStubInstance(handler);
	let mockHandlerQuery = sinon.createStubInstance(handler);
	const historyResponse1 = {
		id: 2,
		results: ['history1', 'history2'],
		has_more: true

	};
	const queryResponse1 = {
		id: 3,
		results: ['query1', 'query2'],
		has_more: true
	};

	const historyResponse2 = {
		id: 2,
		results: ['history3'],
		has_more: false

	};
	const queryResponse2 = {
		id: 3,
		results: ['query3'],
		has_more: false
	};


	let historyQI = new HistoryQueryIterator(mockHandlerHistory, 'mychannel', 'tx1', historyResponse1);
	historyQI.on('data', () => {});
	historyQI.on('end', () => {});
	let queryQI = new StateQueryIterator(mockHandlerQuery, 'mychannel', 'tx2', queryResponse1);
	queryQI.on('data', () => {});
	queryQI.on('end', () => {});
	mockHandlerHistory.handleQueryStateNext.resolves(historyResponse2);
	mockHandlerQuery.handleQueryStateNext.resolves(queryResponse2);
	let historyEmitStub = sinon.stub(historyQI, 'emit');
	let queryEmitStub = sinon.stub(queryQI, 'emit');
	sinon.stub(historyQI, '_getResultFromBytes').returnsArg(0);
	sinon.stub(queryQI, '_getResultFromBytes').returnsArg(0);

	let result = await historyQI.next();
	t.deepEqual(result, {value: 'history1', done: false}, 'history first value correct');
	t.equal(historyEmitStub.callCount, 1, 'history first emit');
	t.deepEqual(historyEmitStub.firstCall.args, ['data', historyQI, {value: 'history1', done: false}], 'history emit should emit the right values');
	result = await historyQI.next();
	t.deepEqual(result, {value: 'history2', done: false}, 'history second value correct');
	t.equal(historyEmitStub.callCount, 2, 'history second emit');
	t.deepEqual(historyEmitStub.secondCall.args, ['data', historyQI, {value: 'history2', done: false}], 'history emit should emit the right values');
	result = await historyQI.next();
	t.deepEqual(result, {value: 'history3', done: true}, 'history third value correct');
	t.equal(historyEmitStub.callCount, 3, 'history 3 data emits');
	t.deepEqual(historyEmitStub.thirdCall.args, ['data', historyQI, {value: 'history3', done: true}], 'history emit should emit the right values');
	result = await historyQI.next();
	t.deepEqual(result, {done: true}, 'history no further data');
	t.deepEqual(historyEmitStub.lastCall.args, ['end', historyQI], 'history end should be emitted');
	t.equal(historyEmitStub.callCount, 4, 'history emits an end');

	result = await queryQI.next();
	t.deepEqual(result, {value: 'query1', done: false}, 'query first value correct');
	t.equal(queryEmitStub.callCount, 1, 'query first emit');
	t.deepEqual(queryEmitStub.firstCall.args, ['data', queryQI, {value: 'query1', done: false}], 'query emit should emit the right values');
	result = await queryQI.next();
	t.deepEqual(result, {value: 'query2', done: false}, 'query second value correct');
	t.equal(queryEmitStub.callCount, 2, 'query second emit');
	t.deepEqual(queryEmitStub.secondCall.args, ['data', queryQI, {value: 'query2', done: false}], 'query emit should emit the right values');
	result = await queryQI.next();
	t.deepEqual(result, {value: 'query3', done: true}, 'query third value correct');
	t.equal(queryEmitStub.callCount, 3, 'query 3 data emits');
	t.deepEqual(queryEmitStub.thirdCall.args, ['data', queryQI, {value: 'query3', done: true}], 'query emit should emit the right values');
	result = await queryQI.next();
	t.deepEqual(result, {done: true}, 'query no further data');
	t.deepEqual(queryEmitStub.lastCall.args, ['end', queryQI], 'query end should be emitted');
	t.equal(queryEmitStub.callCount, 4, 'query emits an end');

});


test('Integration tests for iterators using promises', async (t) => {
	let mockHandlerHistory = sinon.createStubInstance(handler);
	let mockHandlerQuery = sinon.createStubInstance(handler);
	const historyResponse1 = {
		id: 2,
		results: ['history1', 'history2'],
		has_more: true

	};
	const queryResponse1 = {
		id: 3,
		results: ['query1', 'query2'],
		has_more: true
	};

	const historyResponse2 = {
		id: 2,
		results: ['history3'],
		has_more: false

	};
	const queryResponse2 = {
		id: 3,
		results: ['query3'],
		has_more: false
	};


	let historyQI = new HistoryQueryIterator(mockHandlerHistory, 'mychannel', 'tx1', historyResponse1);
	let queryQI = new StateQueryIterator(mockHandlerQuery, 'mychannel', 'tx2', queryResponse1);
	mockHandlerHistory.handleQueryStateNext.resolves(historyResponse2);
	mockHandlerQuery.handleQueryStateNext.resolves(queryResponse2);
	let historyEmitStub = sinon.stub(historyQI, 'emit');
	let queryEmitStub = sinon.stub(queryQI, 'emit');
	sinon.stub(historyQI, '_getResultFromBytes').returnsArg(0);
	sinon.stub(queryQI, '_getResultFromBytes').returnsArg(0);



	let result = await historyQI.next();
	t.deepEqual(result, {value: 'history1', done: false}, 'history first value correct');
	t.equal(historyEmitStub.callCount, 0, 'no event emitted');
	result = await historyQI.next();
	t.deepEqual(result, {value: 'history2', done: false}, 'history second value correct');
	t.equal(historyEmitStub.callCount, 0, 'no event emitted');
	result = await historyQI.next();
	t.deepEqual(result, {value: 'history3', done: true}, 'history third value correct');
	t.equal(historyEmitStub.callCount, 0, 'no event emitted');
	result = await historyQI.next();
	t.deepEqual(result, {done: true}, 'history no further data');
	t.equal(historyEmitStub.callCount, 0, 'no event emitted');

	result = await queryQI.next();
	t.deepEqual(result, {value: 'query1', done: false}, 'query first value correct');
	t.equal(queryEmitStub.callCount, 0, 'no event emitted');
	result = await queryQI.next();
	t.deepEqual(result, {value: 'query2', done: false}, 'query second value correct');
	t.equal(queryEmitStub.callCount, 0, 'no event emitted');
	result = await queryQI.next();
	t.deepEqual(result, {value: 'query3', done: true}, 'query third value correct');
	t.equal(queryEmitStub.callCount, 0, 'no event emitted');
	result = await queryQI.next();
	t.deepEqual(result, {done: true}, 'query no further data');
	t.equal(queryEmitStub.callCount, 0, 'no event emitted');
});
