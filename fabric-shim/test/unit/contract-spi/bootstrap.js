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
/* global describe it beforeEach afterEach after */
/* eslint-disable no-console */
'use strict';

const chai = require('chai');
chai.should();
const expect = chai.expect;
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
const sinon = require('sinon');

const fs = require('fs-extra');
const mockery = require('mockery');


const path = require('path');
// class under test
const pathToRoot = '../../../..';
let Bootstrap;
const Contract = require('fabric-contract-api').Contract;
// const Shim = require(path.join(pathToRoot, 'fabric-shim/lib/chaincode'));
function log(...e) {
    console.log(...e);
}

describe('bootstrap.js', () => {

    /**
     * A fake  contract class; pure loading tests in this file
     */
    class sc extends Contract {
        constructor() {
            super();
        }
        /**
         * @param {object} api api
         */
        alpha(api) {
            log(api);
        }
    }

    class MockChaincodeFromContract {
        constructor(contractClasses) {

        }
    }
    let sandbox;
    let mockShim;
    let mockCmd;
    let readFileStub;
    let pathExistsStub;

    let getArgsStub;

    beforeEach('Sandbox creation', () => {

        mockery.enable({
            warnOnReplace: true,
            warnOnUnregistered: false,
            useCleanCache: true
        });
        sandbox = sinon.createSandbox();
        mockShim = {start : sandbox.stub()};
        getArgsStub = sandbox.stub();
        mockCmd = {getArgs : getArgsStub};
        readFileStub = sandbox.stub();
        pathExistsStub = sandbox.stub();


        getArgsStub.returns({'module-path':'fakepath'});
        mockery.registerMock('yargs', {});
        mockery.registerMock('../chaincode', mockShim);
        // mockery.registerMock('ajv', validator);
        mockery.registerMock('../cmds/startCommand.js', mockCmd);
        mockery.registerMock('./chaincodefromcontract', MockChaincodeFromContract);
        mockery.registerMock('fs-extra', {readFile : readFileStub, pathExists:pathExistsStub});

        Bootstrap = require(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/bootstrap'));

    });

    afterEach('Sandbox restoration', () => {
        mockery.disable();
        sandbox.restore();
    });

    describe('#loadAndValidateMetadata', () => {
        const obj = {
            name: 'some string'
        };
        const jsonObject =  JSON.stringify(obj);


        it ('validate and return the metadata', async () => {
            // const readFileStub = sandbox.stub(fs, 'readFile');
            const metadataPath = 'some path';
            readFileStub.onFirstCall().resolves(Buffer.from(jsonObject));
            readFileStub.onSecondCall().resolves(Buffer.from(JSON.stringify({name: 'some string'})));


            const metadata = await Bootstrap.loadAndValidateMetadata(metadataPath);
            expect(metadata).to.deep.equal(obj);
            sinon.assert.calledTwice(readFileStub);
        });

        it ('fail to validate and throw an error', async () => {
            // const readFileStub = sandbox.stub(fs, 'readFile');
            const metadataPath = 'some path';
            readFileStub.onFirstCall().resolves(Buffer.from(jsonObject));
            readFileStub.onSecondCall().resolves(Buffer.from(JSON.stringify(

                {
                    $id: 'https://example.com/person.schema.json',
                    $schema: 'http://json-schema.org/draft-04/schema#',
                    title: 'Person',
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        one : {
                            type : 'string'
                        }
                    }
                }


            )));

            return expect(Bootstrap.loadAndValidateMetadata(metadataPath)).to.eventually.be.rejectedWith(Error, /Contract metadata does not match the schema/);
        });

        it ('Correct schema path is pointed to in the validate method', async () => {
            const rootPath = path.dirname(__dirname);
            const schemaPath = path.join(rootPath, '../../../fabric-contract-api/schema/contract-schema.json');
            const schemaPathCheck = await fs.pathExists(schemaPath);
            expect(schemaPathCheck).to.equal(true, 'Current contract-schema path: ' + schemaPath + ' is incorrect');
        });

        it('Should correct validate a schema', async () => {
            const json = `
            {
                "firstName": "John",
                "lastName": "Doe",
                "age": 21
              }
            `;
            const schema = `
            {
                "$id": "https://example.com/person.schema.json",
                "$schema": "http://json-schema.org/draft-04/schema#",
                "title": "Person",
                "type": "object",
                "properties": {
                  "firstName": {
                    "type": "string",
                    "description": "The person's first name."
                  },
                  "lastName": {
                    "type": "string",
                    "description": "The person's last name."
                  },
                  "age": {
                    "description": "Age in years which must be equal to or greater than zero.",
                    "type": "integer",
                    "minimum": 0
                  }
                }
              }
            `;

            const metadataPath = 'some path';
            // const readFileStub = sandbox.stub(fs, 'readFile');
            readFileStub.onFirstCall().resolves(Buffer.from(json));
            readFileStub.onSecondCall().resolves(Buffer.from(schema));

            const metadata = await Bootstrap.loadAndValidateMetadata(metadataPath);

            expect(metadata).to.deep.equal(JSON.parse(json));

        });


    });

    describe('#register', () => {

        it ('should pass on the register to the shim', async () => {

            Bootstrap.getMetadata = sandbox.stub().resolves();

            await Bootstrap.register([sc], {}, {});
            sinon.assert.calledOnce(mockShim.start);

        });

    });

    describe('#bootstrap', () => {

        it ('should use the main class defined in the package.json', () => {
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'package.json'), {
                main: 'entrypoint'
            });
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'entrypoint'), {contracts: [sc]});
            const registerStub = sandbox.stub();
            Bootstrap.register = registerStub;
            Bootstrap.bootstrap();
            sinon.assert.calledOnce(registerStub);
            sinon.assert.calledWith(registerStub, [sc]);

        });

        it ('should use the main class defined in the package.json with a single element', () => {
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'package.json'), {
                main: 'entrypoint'
            });
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'entrypoint'), sc);
            const registerStub = sandbox.stub();
            Bootstrap.register = registerStub;
            Bootstrap.bootstrap();
            sinon.assert.calledOnce(registerStub);
            sinon.assert.calledWith(registerStub, [sc]);

        });

        it ('should throw an error if none of the other methods work', () => {
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'package.json'), {
                not_here_main: 'entrypoint'
            });
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'entrypoint'), {contracts: [sc]});
            const registerStub = sandbox.stub();
            Bootstrap.register = registerStub;



            return Bootstrap.bootstrap().should.eventually.be.rejectedWith(/package.json does not contain a 'main' entry for the module/);
        });

        it ('should use the main class defined with contracts exported, and custom serialization', () => {
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'package.json'), {
                main: 'entrypoint3'
            });

            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'entrypoint3'),
                {
                    contracts: [sc],
                    serializers : {
                        transaction: 'wibble',
                        serializers: {
                            'wibble':'wibbleimpl'
                        }
                    }
                });
            const registerStub = sandbox.stub();
            Bootstrap.register = registerStub;
            Bootstrap.bootstrap();
            sinon.assert.calledOnce(registerStub);
            sinon.assert.calledWith(registerStub, [sc]);

        });

        it ('should use the main class defined with contracts exported, and custom serialization', () => {
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'package.json'), {
                main: 'entrypoint3'
            });

            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'entrypoint3'),
                {
                    contracts: [sc],
                    serializers : {
                        serializers: {
                            'wibble':'wibbleimpl'
                        }
                    }
                });
            const registerStub = sandbox.stub();
            Bootstrap.register = registerStub;

            return Bootstrap.bootstrap().should.eventually.be.rejectedWith(/There should be a 'transaction' property to define the serializer for use with transactions/);

        });



    });

    describe('#getMetadata', () => {
        it ('should handle when there are files available', async () => {
            pathExistsStub.returns(true);
            Bootstrap.loadAndValidateMetadata = sandbox.stub().resolves({'hello':'world'});
            const metadata = await Bootstrap.getMetadata();
            metadata.should.deep.equal({'hello':'world'});
        });

        it ('should handle when files not available', async () => {
            pathExistsStub.returns(false);
            const metadata = await Bootstrap.getMetadata();
            metadata.should.deep.equal({});
        });
    });

});
