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
        it ('should jsonSerialized buffering', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);

            dm.serializer.toBuffer = sinon.stub().returns('some buffer');

            const wireBuffer = dm.toWireBuffer('penfold', {some: 'schema'}, 'log data');

            expect(wireBuffer).to.deep.equal('some buffer');
            sinon.assert.calledWith(dm.serializer.toBuffer, 'penfold', {some: 'schema'}, 'log data');
        });

        it ('should handle no schema passed', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);

            dm.serializer.toBuffer = sinon.stub().returns('some buffer');

            const wireBuffer = dm.toWireBuffer('penfold');

            expect(wireBuffer).to.deep.equal('some buffer');
            sinon.assert.calledWith(dm.serializer.toBuffer, 'penfold', {}, undefined);
        });
    });

    describe('#fromWireBuffer', () => {
        it ('should return the same data as the serializer from buffer', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);

            dm.serializer.fromBuffer = sinon.stub().returns({value: 'a value', validateData: 'some validation thing'});

            const {value, validateData} = dm.fromWireBuffer('some buffer', 'some schema', 'some prefix');

            sinon.assert.calledWith(dm.serializer.fromBuffer, 'some buffer', 'some schema', 'some prefix');
            expect(value).to.deep.equal('a value');
            expect(validateData).to.deep.equal('some validation thing');
        });

        it ('should handle no validationData', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);

            dm.serializer.fromBuffer = sinon.stub().returns({value: 'a value', validateData: null});

            const {value, validateData} = dm.fromWireBuffer('some buffer', 'some schema', 'some prefix');

            sinon.assert.calledWith(dm.serializer.fromBuffer, 'some buffer', 'some schema', 'some prefix');
            expect(value).to.deep.equal('a value');
            expect(validateData).to.deep.equal('a value');
        });

        it ('should handle no schema', () => {
            const dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers);

            dm.serializer.fromBuffer = sinon.stub().returns({value: 'a value', validateData: null});

            const {value, validateData} = dm.fromWireBuffer('some buffer');

            sinon.assert.calledWith(dm.serializer.fromBuffer, 'some buffer', {}, undefined);
            expect(value).to.deep.equal('a value');
            expect(validateData).to.deep.equal('a value');
        });
    });

    describe('#handleParameters', () => {

        let dm;

        beforeEach(() => {
            dm = new DataMarshall('jsonSerializer', defaultSerialization.serializers, {});

            dm.fromWireBuffer = sinon.stub()
                .onFirstCall().returns({value: 'some value', validateData: 'some validate data'})
                .onSecondCall().returns({value: 'some other value', validateData: 'some other validate data'});
        });

        it('should handle function with no parameters and none passed', () => {
            const fn = {name:'dullfn'};

            const returned = dm.handleParameters(fn, []);

            expect(returned).to.deep.equal([]);
        });

        it('should handle function with no parameters but some passed', () => {
            const fn = {name:'dullfn'};

            const returned = dm.handleParameters(fn, ['oof', 'some', 'params', 'exist', 123]);

            expect(returned).to.deep.equal(['oof', 'some', 'params', 'exist', '123']);
        });

        it('should handle different length lists', () => {
            const fn = {name:'dullfn', parameters:['wibble']};
            (() => {
                dm.handleParameters(fn, []);
            }).should.throw(/Expected .* parameters/);
        });

        it ('should handle error when schema has not useful fields', () => {
            const fn = {name:'sillyfn', parameters:[
                {
                    name:'one',
                    schema:{
                        useless: 'field'
                    }
                }
            ]};

            (() => {
                dm.handleParameters(fn, ['"one"']);
            }).should.throw(/Incorrect type information .*/);
        });

        it ('should handle error when type invalid', () => {
            const fn = {name:'lessdullfn', parameters:[
                {
                    name:'one',
                    schema:{
                        type:'string'
                    }
                }
            ]};

            const validateStub = sinon.stub().returns(false);
            validateStub.errors = [{message: 'list'}, {message: 'of'}, {message: 'reasons'}, {message: 'why'}, {message: 'params'}, {message: 'were'}, {message: 'wrong'}];
            dm.ajv.compile = sinon.stub().returns(validateStub);

            expect(() => {
                dm.handleParameters(fn, ['"one"'], 'logging prefix');
            }).to.throw(`Unable to validate parameter due to ${JSON.stringify(validateStub.errors.map((err) => { return err.message; }))}`); // eslint-disable-line
            sinon.assert.calledWith(dm.fromWireBuffer, '"one"', {components: {schemas: {  }}, properties: {prop: {type: 'string'}}}, 'logging prefix');
            sinon.assert.calledWith(dm.ajv.compile, {components: {schemas: {}}, properties: {prop: {type: 'string'}}});
            sinon.assert.calledWith(validateStub, {prop: 'some validate data'});
        });

        it ('should handle when type invalid for $ref', () => {
            const fn = {name:'lessdullfn', parameters:[
                {
                    name:'one',
                    schema:{
                        $ref:'#/components/schemas/someComponent'
                    }
                }
            ]};

            const validateStub = sinon.stub().returns(false);
            validateStub.errors = [{message: 'list'}, {message: 'of'}, {message: 'reasons'}, {message: 'why'}, {message: 'params'}, {message: 'were'}, {message: 'wrong'}];
            dm.ajv.compile = sinon.stub().returns(validateStub);

            dm.components = {
                someComponent: {
                    $id: 'someComponent',
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string'
                        }
                    }
                }
            };

            expect(() => {
                dm.handleParameters(fn, ['"one"'], 'logging prefix');
            }).to.throw(`Unable to validate parameter due to ${JSON.stringify(validateStub.errors.map((err) => { return err.message; }))}`); // eslint-disable-line
            sinon.assert.calledWith(dm.fromWireBuffer, '"one"', {
                components: {
                    schemas: {
                        someComponent: {
                            $id: 'someComponent',
                            properties: {name: {type: 'string'}},
                            type: 'object'
                        }
                    }
                },
                properties: {prop: {$ref: '#/components/schemas/someComponent'}}
            }, 'logging prefix');
            sinon.assert.calledWith(validateStub, {prop:'some validate data'});
        });

        it ('should push valid values to returned array for primitve types', () => {
            const fn = {name:'lessdullfn', parameters:[
                {
                    name:'one',
                    schema:{
                        type:'string'
                    }
                },
                {
                    name:'two',
                    schema:{
                        $ref: '#/components/schemas/someComponent'
                    }
                }
            ]};

            const validateStub = sinon.stub().returns(true);

            dm.ajv.compile = sinon.stub().returns(validateStub);

            dm.components = {
                someComponent: {
                    $id: 'someComponent',
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string'
                        }
                    }
                }
            };

            const returned = dm.handleParameters(fn, ['"one"', '"two"'], 'logging prefix');

            sinon.assert.calledTwice(dm.fromWireBuffer);
            sinon.assert.calledWith(dm.fromWireBuffer, '"one"', {
                components: {
                    schemas: {
                        someComponent: {
                            $id: 'someComponent',
                            properties: {name: {type: 'string'}},
                            type: 'object'
                        }
                    }
                },
                properties: {prop: {type: 'string'}}
            }, 'logging prefix');
            sinon.assert.calledWith(dm.fromWireBuffer, '"two"', {
                components: {
                    schemas: {
                        someComponent: {
                            $id: 'someComponent',
                            properties: {name: {type: 'string'}},
                            type: 'object'
                        }
                    }
                },
                properties: {prop: {$ref: '#/components/schemas/someComponent'}}
            }, 'logging prefix');

            sinon.assert.calledTwice(dm.ajv.compile);
            sinon.assert.calledWith(dm.ajv.compile, {components: {schemas: dm.components}, properties: {prop: {type: 'string'}}});
            sinon.assert.calledWith(dm.ajv.compile, {components: {schemas: dm.components}, properties: {prop: {$ref: '#/components/schemas/someComponent'}}});

            sinon.assert.calledTwice(validateStub);
            sinon.assert.calledWith(validateStub, {prop:'some validate data'});
            sinon.assert.calledWith(validateStub, {prop:'some other validate data'});

            expect(returned).to.deep.equal(['some value', 'some other value']);
        });
    });

});
