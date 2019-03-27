/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

/* eslint-disable no-console */
'use strict';

const fs = require('fs-extra');
const path = require('path');

require('chai').should();
const chai = require('chai');
const sinon = require('sinon');
chai.should();
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));

const rewire = require('rewire');
// class under test
const Bootstrap = require('../../../../../lib/contract-spi/bootstrap');
const Contract = require('fabric-contract-api').Contract;
const Generate = rewire('../../../../../lib/cmds/metadata/lib/generate');

function log(...e) {
    // eslint-disable-next-line
    console.log(...e);
}

describe('generate', () => {

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
        constructor(contracts, serializers, metadata, title, version) {
            this.contracts = contracts;
            this.serializers = serializers;
            this.metadata =  metadata;
            this.title = title;
            this.version = version;
        }
    }

    let sandbox;
    let getInfoFromContractStub;
    let getMetadataStub;

    let writeFileStub;
    let mkdirpSyncStub;


    beforeEach('Sandbox creation', () => {
        sandbox = sinon.createSandbox();
        writeFileStub = sandbox.stub();
        mkdirpSyncStub = sandbox.stub();
    });

    afterEach('Sandbox restoration', () => {
        sandbox.restore();
    });

    describe ('#handler', () => {
        const args = {'module-path': process.cwd(), file : path.resolve(process.cwd(), 'file')};

        beforeEach('Sandbox creation', () => {
            const FakeLogger = {
                info : () => {}
            };

            getMetadataStub = sandbox.stub(Bootstrap, 'getMetadata');
            getInfoFromContractStub = sandbox.stub(Bootstrap, 'getInfoFromContract');


            Generate.__set__('logger', FakeLogger);
        });

        afterEach('Sandbox restoration', async () => {
            getMetadataStub.restore();
            getInfoFromContractStub.restore();
            if (args.file) {
                await fs.remove(args.file);
            }
        });

        it ('should write the contract metadata to a json file when no file extension is specified', async () => {
            getMetadataStub.resolves(
                {
                    info: {
                        title: 'some title',
                        version: '0.1.1'
                    }
                }
            );
            getInfoFromContractStub.returns(
                {
                    contracts: [sc],
                    serializers : {},
                    title: 'some title',
                    version: 'some version'
                }
            );
            const originalFS = Generate.__get__('fs');
            Generate.__set__('fs', {writeFile: writeFileStub, mkdirpSync: mkdirpSyncStub});
            const originalChaincodeFromContract = Generate.__get__('ChaincodeFromContract');
            Generate.__set__('ChaincodeFromContract', MockChaincodeFromContract);

            await Generate.handler(args);

            sinon.assert.calledOnce(writeFileStub);
            sinon.assert.calledWith(writeFileStub, args.file + '.json', JSON.stringify(
                {
                    info: {
                        title: 'some title',
                        version: '0.1.1'
                    }
                }, null, 4));
            sinon.assert.calledOnce(mkdirpSyncStub);
            sinon.assert.calledOnce(getInfoFromContractStub);
            sinon.assert.calledOnce(getMetadataStub);

            Generate.__set__('ChaincodeFromContract', originalChaincodeFromContract);
            Generate.__set__('fs', originalFS);
        });

        it ('should write the contract metadata to a json file when the .json file extension is specified', async () => {
            args.file = path.resolve(process.cwd(), 'file.json');
            getMetadataStub.resolves(
                {
                    info: {
                        title: 'some title',
                        version: '0.1.1'
                    }
                }
            );
            getInfoFromContractStub.returns(
                {
                    contracts: [sc],
                    serializers : {},
                    title: 'some title',
                    version: 'some version'
                }
            );
            const originalFS = Generate.__get__('fs');
            Generate.__set__('fs', {writeFile: writeFileStub, mkdirpSync:mkdirpSyncStub});
            const originalChaincodeFromContract = Generate.__get__('ChaincodeFromContract');
            Generate.__set__('ChaincodeFromContract', MockChaincodeFromContract);

            await Generate.handler(args);

            sinon.assert.calledOnce(writeFileStub);
            sinon.assert.calledWith(writeFileStub, args.file, JSON.stringify(
                {
                    info: {
                        title: 'some title',
                        version: '0.1.1'
                    }
                }, null, 4));
            sinon.assert.calledOnce(getInfoFromContractStub);
            sinon.assert.calledOnce(getMetadataStub);

            Generate.__set__('ChaincodeFromContract', originalChaincodeFromContract);
            Generate.__set__('fs', originalFS);
        });

        it ('should write the contract metadata to the specified file extension when a non .json extension is specified', async () => {
            args.file = path.resolve(process.cwd(), 'file.txt');
            getMetadataStub.resolves(
                {
                    info: {
                        title: 'some title',
                        version: '0.1.1'
                    }
                }
            );
            getInfoFromContractStub.returns(
                {
                    contracts: [sc],
                    serializers : {},
                    title: 'some title',
                    version: 'some version'
                }
            );
            const originalFS = Generate.__get__('fs');
            Generate.__set__('fs', {writeFile: writeFileStub, mkdirpSync:mkdirpSyncStub});
            const originalChaincodeFromContract = Generate.__get__('ChaincodeFromContract');
            Generate.__set__('ChaincodeFromContract', MockChaincodeFromContract);

            await Generate.handler(args);

            sinon.assert.calledOnce(writeFileStub);
            sinon.assert.calledWith(writeFileStub, args.file, JSON.stringify(
                {
                    info: {
                        title: 'some title',
                        version: '0.1.1'
                    }
                }, null, 4));
            sinon.assert.calledOnce(getInfoFromContractStub);
            sinon.assert.calledOnce(getMetadataStub);

            Generate.__set__('ChaincodeFromContract', originalChaincodeFromContract);
            Generate.__set__('fs', originalFS);
        });

    });


});
