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
const Ajv = require('ajv');

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
    let ajvStub;

    beforeEach('Sandbox creation', () => {
        sandbox = sinon.createSandbox();

        mockery.enable();
        ajvStub = sinon.createStubInstance(Ajv);
        mockery.registerMock('ajv', ajvStub);
    });

    afterEach('Sandbox restoration', () => {
        sandbox.restore();
        mockery.disable();

    });

    describe('#constructor', () => {

        it ('should create plain object ok', () => {
            const sc0 = new DataMarshall('jsonSerializer', defaultSerialization.serializers, {});
            expect(sc0).to.not.be.null;
        });

        it ('should create plain object ok', () => {
            // use the stanard serializer but under a different name to validate the loading
            mockery.registerMock('myserializer', JSONSerializer, {});
            const sc0 = new DataMarshall('jsonSerializer', {'jsonSerializer':'myserializer'});

            expect(sc0).to.not.be.null;
        });

    });

    describe('#toWireBuffer', () => {

        it ('should return undefined if nothing passed in ', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);
            const wireBuffer = dm.toWireBuffer('penfold');

            const {value, validateData} = dm.fromWireBuffer(wireBuffer);
            value.should.equal('penfold');
            validateData.should.equal('penfold');
        });


        it ('should return undefined if nothing passed in ', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);
            dm.serializer = {fromBuffer : () => {
                return {
                    value:'penfold', validateData:'colonelk'};
            }};

            const {value, validateData} = dm.fromWireBuffer(Buffer.from('hello'));
            value.should.equal('penfold');
            validateData.should.equal('colonelk');
        });
    });

    describe('#handleParameters', () => {

        it('should handle empty list', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);
            const fn = {name:'dullfn'};
            dm.handleParameters(fn, []);
        });

        it('should handle different length lists', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);
            const fn = {name:'dullfn', parameters:['wibble']};
            (() => {
                dm.handleParameters(fn, []);
            }).should.throw(/Expected .* parameters/);
        });

        it('should handle the case where types have come from JS Introspection', () => {
            // i.e. there are the names of then fns but no info on parameters
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);
            const fn = {name:'dullfn'};

            dm.handleParameters(fn, ['"one"', '"two"']);

        });

        it('should handle different primitive types', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);
            const fn = {name:'dullfn', parameters:[
                {
                    name:'one',
                    schema:{
                        type:'string'
                    }
                },
                {
                    name:'two',
                    schema:{
                        type:'string'
                    }
                }
            ]};

            dm.handleParameters(fn, ['"one"', '"two"']);

        });

        it('should handle types that are incorrecly specified', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);
            const fn = {name:'dullfn', parameters:[
                {
                    name:'one',
                    schema:{
                        wibble:'string'
                    }
                }
            ]};

            (() => {
                dm.handleParameters(fn, ['"one"']);
            }).should.throw(/Incorrect type information/);


        });

        it('should handle different primitive types: invalid', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);
            // dm.fromWireBuffer = sandbox.stub().returns({'value':'value', 'data':'data'});
            const validator = sandbox.stub().returns(false);
            dm.ajv = {
                compile: () => {
                    return validator;
                }
            };
            const fn = {name:'dullfn', parameters:[
                {
                    name:'one',
                    schema:{
                        type:'string'
                    }
                },
                {
                    name:'two',
                    schema:{
                        type:'string'
                    }
                }
            ]};

            (() => {
                dm.handleParameters(fn, ['"io"', '"two"']);
            }).should.throw(/Unable to validate/);

        });

        it('should handle different complex types', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);
            // dm.fromWireBuffer = sandbox.stub().returns({'value':'value', 'data':'data'});
            dm.schemas = {
                Asset :
                    {
                        validator: sandbox.stub().returns(true)
                    }
            };
            const fn = {name:'dullfn', parameters:[
                {
                    name:'one',
                    schema:{
                        '$ref':'#/components/schemas/Asset'
                    }
                }
            ]};

            dm.handleParameters(fn, ['"one"']);

        });

        it('should handle different complex types: invalid data', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);
            // dm.fromWireBuffer = sandbox.stub().returns({'value':'value', 'data':'data'});
            dm.schemas = {
                Asset :
                    {
                        validator: sandbox.stub().returns(false)
                    }
            };
            const fn = {name:'dullfn', parameters:[
                {
                    name:'one',
                    schema:{
                        '$ref':'#/components/schemas/Asset'
                    }
                }
            ]};

            (() => {
                dm.handleParameters(fn, ['"one"']);
            }).should.throw(/Unable to validate/);

        });

    });

});
