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
