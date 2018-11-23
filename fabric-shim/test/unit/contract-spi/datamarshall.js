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
const expect = chai.expect;
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
const sinon = require('sinon');
const mockery = require('mockery');
const path = require('path');

// class under test
const pathToRoot = '../../../..';

const JSONSerializer = require(path.join(pathToRoot, 'fabric-contract-api/lib/jsontransactionserializer.js'));
const DataMarshall = require(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/datamarshall.js'));

const defaultSerialization = {
    transaction: 'jsonSerializer',
    serializers: {
        jsonSerializer : JSONSerializer
    }
};

describe('datamarshall.js', () => {

    let sandbox;

    beforeEach('Sandbox creation', () => {
        sandbox = sinon.createSandbox();
        mockery.enable();

    });

    afterEach('Sandbox restoration', () => {
        sandbox.restore();
        mockery.disable();

    });

    describe('#constructor', () => {

        it ('should create plain object ok', () => {
            const sc0 = new DataMarshall('jsonSerializer', defaultSerialization.serializers);
            expect(sc0).to.not.be.null;
        });

        it ('should create plain object ok', () => {
            // use the stanard serializer but under a different name to validate the loading
            mockery.registerMock('myserializer', JSONSerializer);
            const sc0 = new DataMarshall('jsonSerializer', {'jsonSerializer':'myserializer'});

            expect(sc0).to.not.be.null;
        });

    });

    describe('#toWireBuffer', () => {

        it ('should return undefined if nothing passed in ', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);
            dm.fromWireBuffer(dm.toWireBuffer('penfold')).should.equal('penfold');
        });

    });

});
