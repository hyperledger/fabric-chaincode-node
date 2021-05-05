/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* global describe it beforeEach afterEach  */
'use strict';

const chai = require('chai');
chai.should();

chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
const sinon = require('sinon');

const path = require('path');
// class under test
const pathToRoot = '../../..';

const Context = require(path.join(pathToRoot, 'fabric-contract-api/lib/context'));

describe('contract.js', () => {

    let sandbox;

    beforeEach('Sandbox creation', () => {
        sandbox = sinon.createSandbox();
    });

    afterEach('Sandbox restoration', () => {
        sandbox.restore();
    });

    describe('#constructor', () => {

        it ('should create plain object ok', () => {
            const sc0 = new Context();
            sc0.should.be.an.instanceOf(Context);
        });

        it ('should have set* methods', () => {
            const sc0 = new Context();
            sc0.setChaincodeStub('a stub');
            sc0.stub.should.equal('a stub');
            sc0.setClientIdentity('a client identity');
            sc0.clientIdentity.should.equal('a client identity');
        });

    });

});
