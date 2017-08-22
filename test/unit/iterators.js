/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const test = require('../base.js');
const sinon = require('sinon');
const StateQueryIterator = require('fabric-shim/lib/iterators.js').StateQueryIterator;
const HistoryQueryIterator = require('fabric-shim/lib/iterators.js').HistoryQueryIterator;
const handler = require('fabric-shim/lib/handler.js');

test('Iterator constructor tests', (t) => {
	let mockHandler = sinon.createStubInstance(handler);
	let historyQI = new HistoryQueryIterator(mockHandler, 'tx1', 'somebytes');
	let queryQI = new StateQueryIterator(mockHandler, 'tx2', 'someotherbytes');
	t.equal(historyQI.type, 'HISTORY', 'Test History iterator construction');
	t.equal(historyQI.handler, mockHandler, 'Test History iterator construction');
	t.equal(historyQI.txID, 'tx1', 'Test History iterator construction');
	t.equal(historyQI.response, 'somebytes', 'Test History iterator construction');

	t.equal(queryQI.type, 'QUERY', 'Test Query iterator construction');
	t.equal(queryQI.handler, mockHandler, 'Test Query iterator construction');
	t.equal(queryQI.txID, 'tx2', 'Test Query iterator construction');
	t.equal(queryQI.response, 'someotherbytes', 'Test Query iterator construction');
	t.end();
});

test('next: Simple data 1st entry, no more', (t) => {
	let mockHandler = sinon.createStubInstance(handler);
	const historyResponse = {
		results: ['history1', 'history2'],
		has_more: false

	};
	const queryResponse = {
		results: ['query1', 'query2'],
		has_more: false
	};

	let historyQI = new HistoryQueryIterator(mockHandler, 'tx1', historyResponse);
	let queryQI = new StateQueryIterator(mockHandler, 'tx2', queryResponse);
	let historyCreateStub = sinon.stub(historyQI, '_createAndEmitResult').returns({value: 'history1', done: false});
	let queryCreateStub = sinon.stub(queryQI, '_createAndEmitResult').returns({value: 'query1', done: false});

	let allproms = [];
	let historyProm = historyQI.next()
		.then((result) => {
			t.equal(historyCreateStub.calledOnce, true, 'Test history created and emitted');
			t.deepEqual(result, {value: 'history1', done: false}, 'Test history returns correct value');
		});
	allproms.push(historyProm);
	let queryProm = queryQI.next()
		.then((result) => {
			t.equal(queryCreateStub.calledOnce, true, 'Test query created and emitted');
			t.deepEqual(result, {value: 'query1', done: false}, 'Test history returns correct value');
		});
	allproms.push(queryProm);
	Promise.all(allproms).then(() => {
		t.end();
	});
});

test('next: reached end, no more', (t) => {
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

	let historyQI = new HistoryQueryIterator(mockHandler, 'tx1', historyResponse);
	let queryQI = new StateQueryIterator(mockHandler, 'tx2', queryResponse);
	let historyCreateStub = sinon.stub(historyQI, '_createAndEmitResult').returns({value: 'history1', done: false});
	let queryCreateStub = sinon.stub(queryQI, '_createAndEmitResult').returns({value: 'query1', done: false});
	historyQI.currentLoc = 2;
	queryQI.currentLoc = 2;

	let allproms = [];
	let historyProm = historyQI.next()
		.then((result) => {
			t.equal(historyCreateStub.callCount, 0, 'Test history created and emitted never called');
			t.deepEqual(result, {done: true}, 'Test history returns correct value');
		});
	allproms.push(historyProm);
	let queryProm = queryQI.next()
		.then((result) => {
			t.equal(queryCreateStub.callCount, 0, 'Test query created and emitted never called');
			t.deepEqual(result, {done: true}, 'Test query returns correct value');
		});
	allproms.push(queryProm);
	Promise.all(allproms).then(() => {
		t.end();
	});
});

test('next: reached end, has more', (t) => {
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


	let historyQI = new HistoryQueryIterator(mockHandlerHistory, 'tx1', historyResponse1);
	let queryQI = new StateQueryIterator(mockHandlerQuery, 'tx2', queryResponse1);
	let historyCreateStub = sinon.stub(historyQI, '_createAndEmitResult').returns({value: 'history3', done: false});
	let queryCreateStub = sinon.stub(queryQI, '_createAndEmitResult').returns({value: 'query3', done: false});
	mockHandlerHistory.handleQueryStateNext.resolves(historyResponse2);
	mockHandlerQuery.handleQueryStateNext.resolves(queryResponse2);
	historyQI.currentLoc = 2;
	queryQI.currentLoc = 2;

	let allproms = [];
	let historyProm = historyQI.next()
		.then((result) => {
			t.equal(mockHandlerHistory.handleQueryStateNext.calledOnce, true, 'Test history called handleQueryStateNext');
			t.deepEqual(mockHandlerHistory.handleQueryStateNext.firstCall.args, [2, 'tx1']);
			t.equal(historyQI.currentLoc, 0, 'Test history current location is reset');
			t.deepEqual(historyQI.response, historyResponse2, 'Test history response is stored');
			t.equal(historyCreateStub.calledOnce, true, 'Test history created and emitted');
			t.deepEqual(result, {value: 'history3', done: false}, 'Test history returns correct value');
		});
	allproms.push(historyProm);
	let queryProm = queryQI.next()
		.then((result) => {
			t.deepEqual(mockHandlerQuery.handleQueryStateNext.firstCall.args, [3, 'tx2']);
			t.equal(mockHandlerQuery.handleQueryStateNext.calledOnce, true, 'Test history called handleQueryStateNext');
			t.equal(queryQI.currentLoc, 0, 'Test history current location is reset');
			t.deepEqual(queryQI.response, queryResponse2, 'Test history response is stored');
			t.equal(queryCreateStub.calledOnce, true, 'Test query created and emitted');
			t.deepEqual(result, {value: 'query3', done: false}, 'Test history returns correct value');
		});
	allproms.push(queryProm);
	Promise.all(allproms).then(() => {
		t.end();
	});
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

	let historyQI = new HistoryQueryIterator(null, 'tx1', historyResponse1);
	let queryQI = new StateQueryIterator(null, 'tx2', queryResponse1);
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

	let historyQI = new HistoryQueryIterator(null, 'tx1', historyResponse1);
	let queryQI = new StateQueryIterator(null, 'tx2', queryResponse1);
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

	let historyQI = new HistoryQueryIterator(null, 'tx1', historyResponse1);
	let queryQI = new StateQueryIterator(null, 'tx2', queryResponse1);
	let historyGetResultStub = sinon.stub(historyQI, '_getResultFromBytes').returns('history2');
	let queryGetResultStub = sinon.stub(queryQI, '_getResultFromBytes').returns('query2');
	let historyEmitStub = sinon.stub(historyQI, 'emit');
	let queryEmitStub = sinon.stub(queryQI, 'emit');
	historyQI.currentLoc = 1;
	queryQI.currentLoc = 1;

	t.deepEqual(historyQI._createAndEmitResult(), {value: 'history2', done: true}, 'Test history returned value is correct');
	t.equal(historyGetResultStub.calledOnce, true, 'Test history getResultFromBytes called once');
	t.deepEqual(historyGetResultStub.firstCall.args, ['history2'], 'Test history getResultFromBytes passed correct parameter');
	t.equal(historyEmitStub.calledTwice, true, 'Test history emit was called');
	t.deepEqual(historyEmitStub.firstCall.args, ['data', historyQI,{value: 'history2', done: true}], 'Test history emit was called with data');
	t.deepEqual(historyEmitStub.secondCall.args, ['end', historyQI], 'Test history emit was called with data');

	t.deepEqual(queryQI._createAndEmitResult(), {value: 'query2', done: true}, 'Test query returned value is correct');
	t.equal(queryGetResultStub.calledOnce, true, 'Test query getResultFromBytes called once');
	t.deepEqual(queryGetResultStub.firstCall.args, ['query2'], 'Test query getResultFromBytes passed correct parameter');
	t.equal(queryEmitStub.calledTwice, true, 'Test query emit was called');
	t.deepEqual(queryEmitStub.firstCall.args, ['data', queryQI,{value: 'query2', done: true}], 'Test query emit was called with data');
	t.deepEqual(queryEmitStub.secondCall.args, ['end', queryQI], 'Test query emit was called with end');

	t.end();
});

test('close: Test close', (t) => {
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
	let historyQI = new HistoryQueryIterator(mockHandlerHistory, 'tx1', historyResponse);
	let queryQI = new StateQueryIterator(mockHandlerQuery, 'tx2', queryResponse);
	mockHandlerHistory.handleQueryStateClose.resolves('something1');
	mockHandlerQuery.handleQueryStateClose.resolves('something2');
	let allproms = [];
	let hp = historyQI.close().then((res) => {
		t.equal(res, 'something1', 'Test history close resolves to some data');
		t.equal(mockHandlerHistory.handleQueryStateClose.calledOnce, true, 'Test history calls handle querystateclose once');
		t.deepEqual(mockHandlerHistory.handleQueryStateClose.firstCall.args, [1, 'tx1'], 'Test history calls handlestateclose with correct parameters');
	});
	let qp = queryQI.close().then((res) => {
		t.equal(res, 'something2', 'Test query close resolves to some data');
		t.equal(mockHandlerQuery.handleQueryStateClose.calledOnce, true, 'Test query calls handle querystateclose once');
		t.deepEqual(mockHandlerQuery.handleQueryStateClose.firstCall.args, [2, 'tx2'], 'Test query calls handlestateclose with correct parameters');
	});
	allproms.push(hp);
	allproms.push(qp);
	Promise.all(allproms).then(() => {
		t.end();
	});
});

test('Integration tests for iterators', (t) => {
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


	let historyQI = new HistoryQueryIterator(mockHandlerHistory, 'tx1', historyResponse1);
	let queryQI = new StateQueryIterator(mockHandlerQuery, 'tx2', queryResponse1);
	mockHandlerHistory.handleQueryStateNext.resolves(historyResponse2);
	mockHandlerQuery.handleQueryStateNext.resolves(queryResponse2);
	let historyEmitStub = sinon.stub(historyQI, 'emit');
	let queryEmitStub = sinon.stub(queryQI, 'emit');
	sinon.stub(historyQI, '_getResultFromBytes').returnsArg(0);
	sinon.stub(queryQI, '_getResultFromBytes').returnsArg(0);

	let allproms = [];
	let pr = historyQI.next()
		.then((result) => {
			t.deepEqual(result, {value: 'history1', done: false}, 'history first value correct');
			t.equal(historyEmitStub.callCount, 1, 'history first emit');
			t.deepEqual(historyEmitStub.firstCall.args, ['data', historyQI, {value: 'history1', done: false}], 'history emit should emit the right values');
			return historyQI.next();
		})
		.then((result) => {
			t.deepEqual(result, {value: 'history2', done: false}, 'history second value correct');
			t.equal(historyEmitStub.callCount, 2, 'history second emit');
			t.deepEqual(historyEmitStub.secondCall.args, ['data', historyQI, {value: 'history2', done: false}], 'history emit should emit the right values');
			return historyQI.next();
		})
		.then((result) => {
			t.deepEqual(result, {value: 'history3', done: true}, 'history third value correct');
			t.equal(historyEmitStub.callCount, 4, 'history 3 data emits plus end emit');
			t.deepEqual(historyEmitStub.thirdCall.args, ['data', historyQI, {value: 'history3', done: true}], 'history emit should emit the right values');
			t.deepEqual(historyEmitStub.lastCall.args, ['end', historyQI], 'query end should be emitted');
			return historyQI.next();
		})
		.then((result) => {
			t.deepEqual(result, {done: true}, 'history no further data');
			t.equal(historyEmitStub.callCount, 4, 'history no further emits');
		});

	let qr = queryQI.next()
		.then((result) => {
			t.deepEqual(result, {value: 'query1', done: false}, 'query first value correct');
			t.equal(queryEmitStub.callCount, 1, 'query first emit');
			t.deepEqual(queryEmitStub.firstCall.args, ['data', queryQI, {value: 'query1', done: false}], 'query emit should emit the right values');
			return queryQI.next();
		})
		.then((result) => {
			t.deepEqual(result, {value: 'query2', done: false}, 'query second value correct');
			t.equal(queryEmitStub.callCount, 2, 'query second emit');
			t.deepEqual(queryEmitStub.secondCall.args, ['data', queryQI, {value: 'query2', done: false}], 'query emit should emit the right values');
			return queryQI.next();
		})
		.then((result) => {
			t.deepEqual(result, {value: 'query3', done: true}, 'query third value correct');
			t.equal(queryEmitStub.callCount, 4, 'query 3 data emits plus end emit');
			t.deepEqual(queryEmitStub.thirdCall.args, ['data', queryQI, {value: 'query3', done: true}], 'query emit should emit the right values');
			t.deepEqual(queryEmitStub.lastCall.args, ['end', queryQI], 'query end should be emitted');
			return queryQI.next();
		})
		.then((result) => {
			t.deepEqual(result, {done: true}, 'query no further data');
			t.equal(queryEmitStub.callCount, 4, 'query no further emits');
		});



	allproms.push([pr, qr]);
	Promise.all(allproms).then(() => {
		t.end();
	});

});
