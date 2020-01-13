/*
 * Copyright 2020 IBM All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {Context} from 'fabric-contract-api';
import {mock} from 'ts-mockito';

import {Collection} from '../../src/Collection';
import {Ledger} from '../../src/Ledger';

import chai = require('chai');
import chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;


describe('Ledger', () => {

	describe('getLedger()', () => {
		it('should return a Ledger instance', async () => {
			const ctxMock: Context = mock(Context);
			const ledger = await Ledger.getLedger(ctxMock);
			expect(ledger).to.exist;
			expect(ledger).to.be.instanceOf(Ledger);
		});

		it('should always return a new instance', async () => {
			const ctxMock: Context = mock(Context);
			const ledger1 = await Ledger.getLedger(ctxMock);
			const ledger2 = await Ledger.getLedger(ctxMock);
			expect(ledger1).to.not.equal(ledger2);
		});
	});

	describe('getCollection()', () => {
		it('should return a Collection instance', async () => {
			const ctxMock: Context = mock(Context);
			const ledger = await Ledger.getLedger(ctxMock);
			const collection = await ledger.getCollection('mycollection');
			expect(collection).to.exist;
			expect(collection).to.be.instanceOf(Collection);
		});

		it('should always return a new instance', async () => {
			const ctxMock: Context = mock(Context);
			const ledger = await Ledger.getLedger(ctxMock);
			const collection1 = await ledger.getCollection('mycollection');
			const collection2 = await ledger.getCollection('mycollection');
			expect(collection1).to.not.equal(collection2);
		});
	});

	describe('getDefaultCollection()', () => {
		it('should return a Collection instance', async () => {
			const ctxMock: Context = mock(Context);
			const ledger = await Ledger.getLedger(ctxMock);
			const collection = await ledger.getDefaultCollection();
			expect(collection).to.exist;
			expect(collection).to.be.instanceOf(Collection);
		});

		it('should always return a new instance', async () => {
			const ctxMock: Context = mock(Context);
			const ledger = await Ledger.getLedger(ctxMock);
			const collection1 = await ledger.getDefaultCollection();
			const collection2 = await ledger.getDefaultCollection();
			expect(collection1).to.not.equal(collection2);
		});
	});
});
