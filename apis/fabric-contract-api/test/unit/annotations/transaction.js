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
const chai = require('chai');
const expect = chai.expect;

const TransactionAnnotations = rewire('./../../../lib/annotations/transaction');
const Transaction = TransactionAnnotations.Transaction;
const Returns = TransactionAnnotations.Returns;
const Param = TransactionAnnotations.Param;
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

    let sandbox;


    let generateSchemaStub;
    let appendSpy;
    let defineMetadataStub;
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        generateSchemaStub = sandbox.stub(utils, 'generateSchema').returns('some new schema');
        appendSpy = sandbox.spy(utils, 'appendOrUpdate');
        defineMetadataStub = sandbox.stub(Reflect, 'defineMetadata');
    });

    afterEach(() => {
        sandbox.restore();
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

            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').onFirstCall().returns([{
                name: 'someTransaction',
                tag: ['submitTx']
            }]).onSecondCall().returns([
                MockContext,
                'some type',
                MockContext,
                mockFunc,
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
            sinon.assert.calledTwice(generateSchemaStub);
            sinon.assert.calledWith(generateSchemaStub, 'some type');
            sinon.assert.calledWith(generateSchemaStub, 'someFunc');
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:transactions', [{
                name: 'someTransaction',
                tag: ['submitTx'],
            }, {
                name: 'mockKey',
                tag: ['submitTx'],
                parameters: [
                    {
                        name: 'param1',
                        description: '',
                        schema: 'some new schema'
                    },
                    {
                        name: 'param2',
                        description: '',
                        schema: 'some new schema'
                    }
                ]
            }], mockTarget);
        });
        it ('should error if missing type', () => {

            sandbox.stub(Reflect, 'getMetadata').onFirstCall().returns([{
                name: 'someTransaction',
                tag: ['submitTx']
            }]).onSecondCall().returns([
                MockContext,
                'Object'
            ]);

            TransactionAnnotations.__set__('getParams', () => {
                return ['ctx', 'param1'];
            });

            (() => {
                transaction(mockTarget, 'mockKey');
            }).should.throw(/Type not properly specified for parameter .*?, can not process pure Object types/);

        });
        it ('should handle existing transactions of which matches name and already has param metadata', () => {
            const transactions = [{
                name: 'mockKey',
                tag: ['submitTx'],
                parameters: [{
                    name: 'param1',
                    schema: 'some special schema',
                    description: 'a nice detailed description'
                }]
            }, {
                name: 'someOtherTransaction',
                tag: [],
                parameters: [{
                    name: 'param1',
                    schema: 'some schema'
                }]
            }];

            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata')
                .onFirstCall().returns(transactions)
                .onSecondCall().returns([
                    MockContext,
                    'some type',
                    MockContext,
                    'some other type',
                    MockContext,
                ]);

            const findByValueStub = sandbox.stub(utils, 'findByValue')
                .onFirstCall().returns(transactions[0]);

            TransactionAnnotations.__set__('getParams', () => {
                return ['ctx', 'param1', 'ctx2', 'param2', 'ctx3'];
            });

            transaction(mockTarget, 'mockKey');

            sinon.assert.calledTwice(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledWith(getMetadataStub, 'design:paramtypes', mockTarget, 'mockKey');
            sinon.assert.calledOnce(findByValueStub);
            sinon.assert.calledWith(findByValueStub, transactions, 'name', 'mockKey');
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.calledTwice(generateSchemaStub);
            sinon.assert.calledWith(generateSchemaStub, 'some type');
            sinon.assert.calledWith(generateSchemaStub, 'some other type');
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:transactions', [{
                name: 'mockKey',
                tag: ['submitTx'],
                parameters: [
                    {
                        name: 'param1',
                        schema: 'some special schema',
                        description: 'a nice detailed description'
                    },
                    {
                        name: 'param2',
                        description: '',
                        schema: 'some new schema'
                    }
                ]
            }, {
                name: 'someOtherTransaction',
                tag: [],
                parameters: [{
                    name: 'param1',
                    schema: 'some schema'
                }]
            }], mockTarget);
        });

        it ('should create new metadata for fabric:transactions if none exist and handle no params', () => {
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').returns(undefined);

            TransactionAnnotations.__set__('getParams', () => {
                return [];
            });

            transaction(mockTarget, 'mockKey');

            sinon.assert.calledTwice(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledWith(getMetadataStub, 'design:paramtypes', mockTarget, 'mockKey');
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.notCalled(generateSchemaStub);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:transactions', [{
                name: 'mockKey',
                tag: ['submitTx'],
                parameters: []
            }], mockTarget);
        });

        it ('should not add a tag if commit is false', () => {
            transaction = Transaction(false);

            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').returns(undefined);

            TransactionAnnotations.__set__('getParams', () => {
                return [];
            });

            transaction(mockTarget, 'mockKey');

            sinon.assert.calledTwice(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledWith(getMetadataStub, 'design:paramtypes', mockTarget, 'mockKey');
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.notCalled(generateSchemaStub);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:transactions', [{
                name: 'mockKey',
                tag: [],
                parameters: []
            }], mockTarget);
        });
    });

    describe('Returns', () => {

        let returns;
        beforeEach(() => {
            returns = Returns('someType');
        });

        it ('should handle existing transactions', () => {
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').returns([{
                name: 'someTransaction',
                tag: ['submitTx'],
                parameters: []
            }]);

            returns(mockTarget, 'mockKey');

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledOnce(generateSchemaStub);
            sinon.assert.calledWith(generateSchemaStub, 'someType');
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:transactions', [{
                name: 'someTransaction',
                tag: ['submitTx'],
                parameters: []
            },  {
                name: 'mockKey',
                returns: 'some new schema'
            }], mockTarget);
        });

        it ('should handle when there are no existing transactions', () => {
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').returns(undefined);

            returns(mockTarget, 'mockKey');

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledOnce(generateSchemaStub);
            sinon.assert.calledWith(generateSchemaStub, 'someType');
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:transactions', [{
                name: 'mockKey',
                returns: 'some new schema'
            }], mockTarget);
        });
    });

    describe('Param', () => {
        let param;
        beforeEach(() => {
            param = Param('some param', 'some type', 'some description');
        });

        it ('should overwrite when the transaction exists and param of name already in', () => {
            const transactions = [{
                name: 'transaction1',
                parameters: [{
                    name: 'some param',
                    schema: 'some existing schema',
                    description: 'a nice description'
                }, {
                    name: 'some other param',
                    schema: 'some existing schema',
                    description: 'another nice description'
                }]
            }, {
                name: 'transaction2',
                parameters: [{
                    name: 'some param',
                    schema: 'some existing schema'
                }]
            }];

            const expectedTransactions = JSON.parse(JSON.stringify(transactions));
            expectedTransactions[0].parameters[0].schema = 'some new schema';
            expectedTransactions[0].parameters[0].description = 'some description';

            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').returns(transactions);
            const findByValueStub = sandbox.stub(utils, 'findByValue')
                .onFirstCall().returns(transactions[0])
                .onSecondCall().returns(transactions[0].parameters[0]);

            param(mockTarget, 'mockKey');

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWithExactly(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledTwice(findByValueStub);
            sinon.assert.calledWithExactly(findByValueStub, transactions, 'name', 'mockKey');
            sinon.assert.calledWithExactly(findByValueStub, transactions[0].parameters, 'name', 'some param');
            sinon.assert.calledOnce(generateSchemaStub);
            sinon.assert.calledWithExactly(generateSchemaStub, 'some type');
            expect(transactions).to.deep.eq(expectedTransactions);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWithExactly(defineMetadataStub, 'fabric:transactions', transactions, mockTarget);
        });

        it ('should overwrite existing transaction but add new param when one with name does not exist', () => {
            const transactions = [{
                name: 'transaction1',
                parameters: [{
                    name: 'some other param',
                    schema: 'some existing schema'
                }]
            }, {
                name: 'transaction2',
                parameters: [{
                    name: 'some param',
                    schema: 'some existing schema'
                }]
            }];

            const expectedTransactions = JSON.parse(JSON.stringify(transactions));
            expectedTransactions[0].parameters[1] = {
                name: 'some param',
                description: 'some description',
                schema: 'some new schema'
            };

            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').returns(transactions);
            const findByValueStub = sandbox.stub(utils, 'findByValue')
                .onFirstCall().returns(transactions[0])
                .onSecondCall().returns(null);

            param(mockTarget, 'mockKey');

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWithExactly(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledTwice(findByValueStub);
            sinon.assert.calledWithExactly(findByValueStub, transactions, 'name', 'mockKey');
            sinon.assert.calledWithExactly(findByValueStub, transactions[0].parameters, 'name', 'some param');
            sinon.assert.calledOnce(generateSchemaStub);
            sinon.assert.calledWithExactly(generateSchemaStub, 'some type');
            expect(transactions).to.deep.eq(expectedTransactions);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWithExactly(defineMetadataStub, 'fabric:transactions', transactions, mockTarget);
        });

        it ('should append to transaction a new parameters array when transaction exists but has not parameters field', () => {
            const transactions = [{
                name: 'mockKey'
            }, {
                name: 'transaction2',
                parameters: [{
                    name: 'some param',
                    schema: 'some existing schema'
                }]
            }];

            const expectedTransactions = JSON.parse(JSON.stringify(transactions));
            expectedTransactions[0].parameters = [{
                name: 'some param',
                description: 'some description',
                schema: 'some new schema'
            }];

            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').returns(transactions);
            const findByValueStub = sandbox.stub(utils, 'findByValue')
                .onFirstCall().returns(transactions[0]);

            param(mockTarget, 'mockKey');

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWithExactly(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledOnce(findByValueStub);
            sinon.assert.calledWithExactly(findByValueStub, transactions, 'name', 'mockKey');
            sinon.assert.calledOnce(generateSchemaStub);
            sinon.assert.calledWithExactly(generateSchemaStub, 'some type');
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.calledWithExactly(appendSpy, transactions, 'name', 'mockKey', {
                parameters: [{
                    name: 'some param',
                    description: 'some description',
                    schema: 'some new schema'
                }]
            });
            expect(transactions).to.deep.eq(expectedTransactions);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWithExactly(defineMetadataStub, 'fabric:transactions', transactions, mockTarget);
        });

        it ('should handle when no transaction exists', () => {
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').returns(undefined);
            const findByValueStub = sandbox.stub(utils, 'findByValue')
                .onFirstCall().returns(null);

            param(mockTarget, 'mockKey');

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWithExactly(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledOnce(findByValueStub);
            sinon.assert.calledWithExactly(findByValueStub, sinon.match.any, 'name', 'mockKey');
            sinon.assert.calledOnce(generateSchemaStub);
            sinon.assert.calledWithExactly(generateSchemaStub, 'some type');
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWithExactly(defineMetadataStub, 'fabric:transactions', [{
                name: 'mockKey',
                parameters: [{
                    name: 'some param',
                    description: 'some description',
                    schema: 'some new schema'
                }]
            }], mockTarget);
        });

        it ('should handle when no description passed', () => {
            const getMetadataStub = sandbox.stub(Reflect, 'getMetadata').returns(undefined);
            const findByValueStub = sandbox.stub(utils, 'findByValue')
                .onFirstCall().returns(null);

            param = Param('some param', 'some type');
            param(mockTarget, 'mockKey');

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWithExactly(getMetadataStub, 'fabric:transactions', mockTarget);
            sinon.assert.calledOnce(findByValueStub);
            sinon.assert.calledWithExactly(findByValueStub, sinon.match.any, 'name', 'mockKey');
            sinon.assert.calledOnce(generateSchemaStub);
            sinon.assert.calledWithExactly(generateSchemaStub, 'some type');
            sinon.assert.calledOnce(appendSpy);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWithExactly(defineMetadataStub, 'fabric:transactions', [{
                name: 'mockKey',
                parameters: [{
                    name: 'some param',
                    description: '',
                    schema: 'some new schema'
                }]
            }], mockTarget);
        });
    });
});
