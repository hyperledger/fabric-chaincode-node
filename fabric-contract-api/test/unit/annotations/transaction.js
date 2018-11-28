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

const sinon = require('sinon');
const rewire = require('rewire');

const TransactionAnnotations = rewire('./../../../lib/annotations/transaction');
const Transaction = TransactionAnnotations.Transaction;
const Returns = TransactionAnnotations.Returns;
const utils = require('../../../lib/annotations/utils');
const Context = require('../../../lib/context');
require('reflect-metadata');

describe('Transaction.js', () => {
    class MockContext extends Context {}

    const mockTarget = {
        mockKey: 'something',
        createContext() {
            return new MockContext();
        }
    };


    let appendSpy;
    let defineMetadataStub;
    beforeEach(() => {
        appendSpy = sinon.spy(utils, 'appendOrUpdate');
        defineMetadataStub = sinon.stub(Reflect, 'defineMetadata');
    });

    afterEach(() => {
        appendSpy.restore();
        defineMetadataStub.restore();
    });

    describe('Transaction', () => {
        let origGetParams;

        before(() => {
            origGetParams = TransactionAnnotations.__get__('getParams');
        });

        let transaction;
        beforeEach(() => {
            transaction = Transaction();
        });

        afterEach(() => {
            TransactionAnnotations.__set__('getParams', origGetParams);
        });

        it ('should handle existing transactions', () => {
            const mockFunc = function someFunc() {};

            const getMetadataStub = sinon.stub(Reflect, 'getMetadata').onFirstCall().returns([{
                name: 'someTransaction',
                tag: ['submitTx'],
                parameters: []
            }]).onSecondCall().returns([
                MockContext,
                mockFunc,
                MockContext,
                'someType',
                MockContext,
            ]);

            TransactionAnnotations.__set__('getParams', () => {
                return ['ctx', 'param1', 'ctx2', 'param2', 'ctx3'];
            });

            transaction(mockTarget, 'mockKey');

            sinon.assert.calledTwice(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledWith(getMetadataStub, 'design:paramtypes', mockTarget, 'mockKey');
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:transactions', [{
                name: 'someTransaction',
                tag: ['submitTx'],
                parameters: []
            }, {
                name: 'mockKey',
                tag: ['submitTx'],
                parameters: [
                    {
                        name: 'param1',
                        description: '',
                        schema: {
                            $ref: '#/components/schemas/someFunc'
                        }
                    },
                    {
                        name: 'param2',
                        description: '',
                        schema: {
                            $ref: '#/components/schemas/someType'
                        }
                    }
                ]
            }], mockTarget);
            getMetadataStub.restore();
        });

        it ('should handle existing transactions with primitives', () => {
            const mockFunc = function someFunc() {};

            const getMetadataStub = sinon.stub(Reflect, 'getMetadata').onFirstCall().returns([{
                name: 'someTransaction',
                tag: ['submitTx'],
                parameters: []
            }]).onSecondCall().returns([
                MockContext,
                mockFunc,
                MockContext,
                'string',
                MockContext,
            ]);

            TransactionAnnotations.__set__('getParams', () => {
                return ['ctx', 'param1', 'ctx2', 'param2', 'ctx3'];
            });

            transaction(mockTarget, 'mockKey');

            sinon.assert.calledTwice(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledWith(getMetadataStub, 'design:paramtypes', mockTarget, 'mockKey');
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:transactions', [{
                name: 'someTransaction',
                tag: ['submitTx'],
                parameters: []
            }, {
                name: 'mockKey',
                tag: ['submitTx'],
                parameters: [
                    {
                        name: 'param1',
                        description: '',
                        schema: {
                            $ref: '#/components/schemas/someFunc'
                        }
                    },
                    {
                        name: 'param2',
                        description: '',
                        schema: {
                            type:'string'
                        }
                    }
                ]
            }], mockTarget);
            getMetadataStub.restore();
        });

        it ('should create new metadata for fabric:transactions if none exist and handle no params', () => {
            const getMetadataStub = sinon.stub(Reflect, 'getMetadata').returns(undefined);

            TransactionAnnotations.__set__('getParams', () => {
                return [];
            });

            transaction(mockTarget, 'mockKey');

            sinon.assert.calledTwice(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledWith(getMetadataStub, 'design:paramtypes', mockTarget, 'mockKey');
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:transactions', [{
                name: 'mockKey',
                tag: ['submitTx'],
                parameters: []
            }], mockTarget);
            getMetadataStub.restore();
        });

        it ('should not add a tag if commit is false', () => {
            transaction = Transaction(false);

            const getMetadataStub = sinon.stub(Reflect, 'getMetadata').returns(undefined);

            TransactionAnnotations.__set__('getParams', () => {
                return [];
            });

            transaction(mockTarget, 'mockKey');

            sinon.assert.calledTwice(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledWith(getMetadataStub, 'design:paramtypes', mockTarget, 'mockKey');
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:transactions', [{
                name: 'mockKey',
                tag: [],
                parameters: []
            }], mockTarget);

            getMetadataStub.restore();
        });
    });

    describe('Returns', () => {

        let returns;
        beforeEach(() => {
            returns = Returns('someType');
        });

        it ('should handle existing transactions', () => {
            const getMetadataStub = sinon.stub(Reflect, 'getMetadata').returns([{
                name: 'someTransaction',
                tag: ['submitTx'],
                parameters: []
            }]);

            returns(mockTarget, 'mockKey');

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:transactions', [{
                name: 'someTransaction',
                tag: ['submitTx'],
                parameters: []
            },  {
                name: 'mockKey',
                returns: [{
                    name: 'success',
                    schema: {
                        $ref: '#/components/schemas/someType'
                    }
                }]
            }], mockTarget);

            getMetadataStub.restore();
        });

        it ('should handle when there are no', () => {
            const getMetadataStub = sinon.stub(Reflect, 'getMetadata').returns(undefined);

            returns(mockTarget, 'mockKey');

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:transactions', [{
                name: 'mockKey',
                returns:[{
                    name: 'success',
                    schema: {
                        $ref: '#/components/schemas/someType'
                    }
                }]
            }], mockTarget);

            getMetadataStub.restore();
        });

        it ('should handle when it is a string', () => {
            const getMetadataStub = sinon.stub(Reflect, 'getMetadata').returns(undefined);

            returns = Returns('string');
            returns(mockTarget, 'mockKey');

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:transactions', [{
                name: 'mockKey',
                returns:[{
                    name: 'success',
                    schema: {
                        type: 'string'
                    }
                }]
            }], mockTarget);

            getMetadataStub.restore();
        });

    });
});
