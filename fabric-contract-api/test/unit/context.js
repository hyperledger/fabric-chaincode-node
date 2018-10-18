/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
