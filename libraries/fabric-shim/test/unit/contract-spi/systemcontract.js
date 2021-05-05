/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* global describe it beforeEach afterEach  */
'use strict';

// test specific libraries
const chai = require('chai');
chai.should();
const expect = chai.expect;
const rewire = require('rewire');
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
const sinon = require('sinon');

const path = require('path');

// class under test
const pathToRoot = '../../../..';
const SystemContract = rewire(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/systemcontract'));

describe('SystemContract', () => {

    let sandbox;

    beforeEach('Sandbox creation', () => {
        sandbox = sinon.createSandbox();

    });

    afterEach('Sandbox restoration', () => {
        sandbox.restore();
    });

    describe('#constructor', () => {

        it ('should create correctly', () => {
            const meta = new SystemContract();
            expect(meta.getName()).to.equal('org.hyperledger.fabric');
        });

    });

    describe('#GetMetadata', () => {

        it ('should get the buffer', async () => {
            const meta = new SystemContract();
            meta._setMetadata({wibble:'good'});
            const md = await meta.GetMetadata();
            expect(md).to.deep.equal({wibble:'good'});

        });


    });


});
