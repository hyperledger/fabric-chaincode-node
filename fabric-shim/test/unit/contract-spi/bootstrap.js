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
const rewire = require('rewire');

const fs = require('fs-extra');
const mockery = require('mockery');
const path = require('path');

// class under test
const pathToRoot = '../../../..';
let Bootstrap;
const Contract = require('fabric-contract-api').Contract;

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
        constructor(contractClasses) {}
    }

    let sandbox;
    let mockShim;
    let mockCmd;
    let readFileStub;
    let pathExistsStub;
    let getArgsStub;
    let getInfoFromContractStub;
    let getMetadataStub;

    beforeEach('Sandbox creation', () => {
        mockery.enable({
            warnOnReplace: false,
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
        mockery.registerMock('../cmds/startCommand.js', mockCmd);
        mockery.registerMock('./chaincodefromcontract', MockChaincodeFromContract);
        mockery.registerMock('fs-extra', {pathExists:pathExistsStub, readFileSync : readFileStub});

        Bootstrap = rewire(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/bootstrap'));
    });

    afterEach('Sandbox restoration', () => {
        mockery.deregisterAll();
        mockery.disable();
        sandbox.restore();
    });

    describe('#register', () => {

        it('should pass on the register to the shim', async () => {
            await Bootstrap.register([sc], {}, {}, 'some title', 'some version');
            sinon.assert.calledOnce(mockShim.start);
        });

    });

    describe('#bootstrap', () => {

        beforeEach('Sandbox creation', () => {
            getMetadataStub = sandbox.stub(Bootstrap, 'getMetadata');
            getInfoFromContractStub = sandbox.stub(Bootstrap, 'getInfoFromContract');
        });

        afterEach('Sandbox restoration', () => {
            getMetadataStub.restore();
            getInfoFromContractStub.restore();
        });

        it ('should correctly call the register method', async () => {
            getMetadataStub.resolves({});
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'entrypoint'), {contracts: [sc]});
            const registerStub = sandbox.stub();
            Bootstrap.register = registerStub;
            getInfoFromContractStub.returns({contracts: [sc], serializers : {}, title: 'some title', version: 'some version'});

            await Bootstrap.bootstrap();

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledOnce(getInfoFromContractStub);
            sinon.assert.calledOnce(registerStub);
            sinon.assert.calledWith(registerStub, [sc], {}, {}, 'some title', 'some version');
        });
    });

    describe('#getInfoFromContract', () => {

        beforeEach('Sandbox creation', () => {
            getMetadataStub = sandbox.stub(Bootstrap, 'getMetadata');
        });

        afterEach('Sandbox restoration', () => {
            getMetadataStub.restore();
        });

        it ('should use the main class defined in the package.json', () => {
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'package.json'), {
                main: 'entrypoint'
            });
            mockery.registerMock('fabric-contract-api',
                {
                    JSONSerializer: {
                        'wibble1': 'wibbleimpl1'
                    }
                }
            );
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'entrypoint'), {contracts: [sc]});
            const {contracts} = Bootstrap.getInfoFromContract('fakepath');

            expect({contracts}).to.deep.equal({contracts: [sc]});
        });

        it ('should use the main class defined in the package.json with a single element', () => {
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'package.json'), {
                main: 'entrypoint2',
                name: 'some title',
                version: 'some version'
            });
            mockery.registerMock('fabric-contract-api',
                {
                    JSONSerializer: {
                        'wibble1': 'wibbleimpl1'
                    }
                }
            );
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'entrypoint2'), sc);

            const {contracts} = Bootstrap.getInfoFromContract('fakepath');

            expect(contracts).to.deep.equal([sc]);
        });

        it ('should throw an error if there is no json.main', () => {
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'package.json'), {
                not_here_main: 'entrypoint',
            });
            mockery.registerMock('fabric-contract-api',
                {
                    JSONSerializer: {
                        'wibble': 'wibbleimpl'
                    }
                }
            );
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'entrypoint'), {contracts: [sc]});
            expect(() => {
                Bootstrap.getInfoFromContract('fakepath');
            }).to.throw(/package.json does not contain a 'main' entry for the module/);
        });

        it ('should use the main class defined with contracts exported, and custom serialization', () => {
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'package.json'), {
                main: 'entrypoint3',
                name: 'some title',
                version: 'some version'
            });
            mockery.registerMock('fabric-contract-api',
                {
                    JSONSerializer: {
                        'wibble1': 'wibbleimpl1'
                    }
                }
            );
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'entrypoint3'),
                {
                    contracts: [sc],
                    serializers : {
                        transaction: 'wibble',
                        serializers: {
                            'wibble2': 'wibbleimpl2'
                        }
                    }
                }
            );

            const {contracts, serializers, title, version} = Bootstrap.getInfoFromContract('fakepath');

            expect({contracts, serializers, title, version}).to.deep.equal({contracts: [sc],
                serializers : {
                    transaction: 'wibble',
                    serializers: {
                        jsonSerializer: {
                            'wibble1': 'wibbleimpl1',
                        },
                        'wibble2': 'wibbleimpl2'
                    }
                }, title: 'some title', version: 'some version'});

        });

        it ('should throw an error if there is no transaction property', () => {
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'package.json'), {
                main: 'entrypoint3',
                name: 'some title',
                version: 'some version'
            });
            mockery.registerMock('fabric-contract-api',
                {
                    JSONSerializer: {
                        'wibble1': 'wibbleimpl1'
                    }
                }
            );
            mockery.registerMock(path.resolve(process.cwd(), 'fakepath', 'entrypoint3'),
                {
                    contracts: [sc],
                    serializers : {
                        serializers: {
                            'wibble2': 'wibbleimpl2'
                        }
                    }
                }
            );

            expect(() => {
                Bootstrap.getInfoFromContract('fakepath');
            }).to.throw(/There should be a 'transaction' property to define the serializer for use with transactions/);
        });

    });

    describe('#getMetadata', () => {

        it ('should handle when there are files available', async () => {
            pathExistsStub.returns(true);
            Bootstrap.loadAndValidateMetadata = sandbox.stub().resolves({'hello':'world'});

            const metadata = await Bootstrap.getMetadata('fake path');

            metadata.should.deep.equal({'hello':'world'});
        });

        it ('should handle when files not available', async () => {
            pathExistsStub.returns(false);

            const metadata = await Bootstrap.getMetadata('fake path');

            metadata.should.deep.equal({});
        });

    });

    describe('#loadAndValidateMetadata', () => {

        const obj = {
            name: 'some string'
        };
        const jsonObject =  JSON.stringify(obj);
        class mockAjv {
            constructor() {}
            addMetaSchema() {}
            validate() {
                this.errors = 'some error';
                return false;
            }
        }

        it ('validate and return the metadata', () => {
            const metadataPath = 'some path';
            readFileStub.onFirstCall().returns(Buffer.from(jsonObject));
            readFileStub.onSecondCall().returns(Buffer.from(JSON.stringify({name: 'some string'})));

            const metadata = Bootstrap.loadAndValidateMetadata(metadataPath);
            expect(metadata).to.deep.equal(obj);
            sinon.assert.calledTwice(readFileStub);
        });

        it ('fail to validate and throw an error', () => {
            const metadataPath = 'some path';
            readFileStub.onFirstCall().returns(Buffer.from(jsonObject));
            readFileStub.onSecondCall().returns(Buffer.from(JSON.stringify(
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
            const originalAjv = Bootstrap.__get__('Ajv');
            Bootstrap.__set__('Ajv', mockAjv);
            (() => {
                Bootstrap.loadAndValidateMetadata(metadataPath);
            }).should.throw(Error, /Contract metadata does not match the schema: "some error"/);

            Bootstrap.__set__('Ajv', originalAjv);
        });

        it ('Correct schema path is pointed to in the validate method', () => {
            const schemaPath = path.resolve(__dirname, '../../../../fabric-contract-api/schema/contract-schema.json');
            const schemaPathCheck = fs.pathExistsSync(schemaPath);
            expect(schemaPathCheck).to.equal(true, 'Current contract-schema path: ' + schemaPath + ' is incorrect');
        });

        it('Should correct validate a schema', () => {
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
            readFileStub.onFirstCall().returns(Buffer.from(json));
            readFileStub.onSecondCall().returns(Buffer.from(schema));

            const metadata = Bootstrap.loadAndValidateMetadata(metadataPath);

            expect(metadata).to.deep.equal(JSON.parse(json));
        });

    });

});
