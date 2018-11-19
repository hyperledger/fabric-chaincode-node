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
const fs = require('fs-extra');

const path = require('path');
const StartCommand = require('../../../lib/cmds/startCommand.js');

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
            expect(meta.getNamespace()).to.equal('org.hyperledger.fabric');
        });

    });

    describe('#GetMetadata', () => {
        let getArgsStub;
        let readFileStub;
        let pathExistsStub;
        const jsonObject = JSON.stringify({
            name: 'some string'
        });
        const myYargs = {
            'argv': {
                '$0': 'fabric-chaincode-node',
                'peer.address': 'localhost:7051',
                'chaincode-id-name': 'mycc'
            }
        };

        beforeEach('', () => {
            getArgsStub = sandbox.stub(StartCommand, 'getArgs').returns({
                'module-path': '/some/path'
            });
            SystemContract.__set__('yargs', myYargs);
        });

        afterEach('', () => {
            sandbox.restore();
        });

        it ('should get the buffer', async () => {
            const meta = new SystemContract();

            const chaincodeMock = {
                getContracts : sandbox.stub().returns({})
            };
            meta._setChaincode(chaincodeMock);
            pathExistsStub = sandbox.stub(fs, 'pathExists').returns(false);

            const data = await meta.GetMetadata();
            expect(data.toString()).to.equal('{}');
            sinon.assert.calledOnce(getArgsStub);
            sinon.assert.calledWith(getArgsStub, myYargs);
            sinon.assert.calledOnce(chaincodeMock.getContracts);

        });

        it ('should validate the developers metadata and return it', async () => {
            const meta = new SystemContract();
            class validator {
                constructor() {}
                addMetaSchema() {
                    return true;
                }
                validate() {
                    return true;
                }
            }
            const ajvOriginal = SystemContract.__get__('Ajv');
            SystemContract.__set__('Ajv', validator);

            const chaincodeMock = {
                getContracts : sandbox.stub().returns({})
            };
            pathExistsStub = sandbox.stub(fs, 'pathExists').returns(true);
            readFileStub = sandbox.stub(fs, 'readFile');
            readFileStub.onFirstCall().returns(Buffer.from(jsonObject));
            readFileStub.onSecondCall().returns(Buffer.from(JSON.stringify({name: 'some string'})));
            const data = await meta.GetMetadata();

            expect(data).to.equal(jsonObject);
            sinon.assert.calledOnce(getArgsStub);
            sinon.assert.calledOnce(pathExistsStub);
            sinon.assert.calledTwice(readFileStub);
            sinon.assert.calledWith(getArgsStub, myYargs);
            sinon.assert.notCalled(chaincodeMock.getContracts);

            SystemContract.__set__('Ajv', ajvOriginal);
        });

        it ('should throw an error when validating the developers incorrect metadata', async () => {
            const meta = new SystemContract();
            class validator {
                constructor() {}
                addMetaSchema() {
                    return true;
                }
                validate() {
                    return false;
                }
            }
            SystemContract.__set__('yargs', myYargs);
            const ajvOriginal = SystemContract.__get__('Ajv');
            SystemContract.__set__('Ajv', validator);

            const chaincodeMock = {
                getContracts : sandbox.stub().returns('test')
            };
            pathExistsStub = sandbox.stub(fs, 'pathExists').returns(true);
            readFileStub = sandbox.stub(fs, 'readFile');
            readFileStub.onFirstCall().returns(Buffer.from(jsonObject));
            readFileStub.onSecondCall().returns(Buffer.from(JSON.stringify({name: 'some other string'})));

            await expect(meta.GetMetadata()).to.eventually.be.rejectedWith(Error, 'Contract metadata does not match the schema');
            sinon.assert.calledOnce(getArgsStub);
            sinon.assert.calledOnce(pathExistsStub);
            sinon.assert.calledTwice(readFileStub);
            sinon.assert.calledWith(getArgsStub, myYargs);
            sinon.assert.notCalled(chaincodeMock.getContracts);

            SystemContract.__set__('Ajv', ajvOriginal);
        });
    });

    describe('#_loadAndValidate', () => {
        const jsonObject =  JSON.stringify({
            name: 'some string'
        });
        afterEach('', () => {
            sandbox.restore();
        });

        it ('validate and return the metadata', async () => {
            const readFileStub = sandbox.stub(fs, 'readFile');
            const meta = new SystemContract();
            const metadataPath = 'some path';
            readFileStub.onFirstCall().returns(Buffer.from(jsonObject));
            readFileStub.onSecondCall().returns(Buffer.from(JSON.stringify({name: 'some string'})));
            class validator {
                constructor() {}
                addMetaSchema() {
                }
                validate() {
                    return true;
                }
            }
            const ajvOriginal = SystemContract.__get__('Ajv');
            SystemContract.__set__('Ajv', validator);

            const metadata = await meta._loadAndValidateMetadata(metadataPath);
            expect(metadata).to.equal(jsonObject);
            sinon.assert.calledTwice(readFileStub);
            SystemContract.__set__('Ajv', ajvOriginal);

        });

        it ('fail to validate and throw an error', async () => {
            const readFileStub = sandbox.stub(fs, 'readFile');
            const meta = new SystemContract();
            const metadataPath = 'some path';
            readFileStub.onFirstCall().returns(Buffer.from(jsonObject));
            readFileStub.onSecondCall().returns(Buffer.from(JSON.stringify({name: 'some other string'})));
            class validator {
                constructor() {}
                addMetaSchema() {
                }
                validate() {
                    this.errors = 'some error string';
                    return false;
                }
            }
            const ajvOriginal = SystemContract.__get__('Ajv');
            SystemContract.__set__('Ajv', validator);

            await expect(meta._loadAndValidateMetadata(metadataPath)).to.eventually.be.rejectedWith(Error, 'Contract metadata does not match the schema: "some error string"');
            sinon.assert.calledTwice(readFileStub);
            SystemContract.__set__('Ajv', ajvOriginal);

        });

        it ('Correct schema path is pointed to in the validate method', async () => {
            const rootPath = path.dirname(__dirname);
            const schemaPath = path.join(rootPath, '../../../fabric-contract-api/schema/contract-schema.json');
            const schemaPathCheck = await fs.pathExists(schemaPath);
            expect(schemaPathCheck).to.equal(true, 'Current contract-schema path: ' + schemaPath + ' is incorrect');
        });
    });

});
