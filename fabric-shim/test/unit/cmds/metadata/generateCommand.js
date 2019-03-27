/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

/* eslint-disable no-console */
'use strict';

const yargs = require('yargs');
require('chai').should();
const chai = require('chai');
const sinon = require('sinon');
chai.should();
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));

const rewire = require('rewire');
// class under test
const GenerateCommand = rewire('../../../../lib/cmds/metadata/generateCommand.js');


describe('GenerateCommand', () => {

    let sandbox;

    beforeEach('Sandbox creation', () => {
        sandbox = sinon.createSandbox();
    });

    afterEach('Sandbox restoration', () => {
        sandbox.restore();
    });

    describe('#builder function', () => {

        beforeEach(() => {
            sandbox.stub(yargs, 'usage').returns(yargs);
            sandbox.stub(yargs, 'options').returns(yargs);
            sandbox.stub(yargs, 'strict').returns(yargs);
            sandbox.stub(yargs, 'requiresArg').returns(yargs);
            sandbox.stub(yargs, 'demandCommand').returns(yargs);
            sandbox.stub(yargs, 'commandDir');
        });

        it ('should have the correct command and description', function () {
            GenerateCommand.command.should.include('generate');
            GenerateCommand.desc.should.include('Generate');
        });

        it ('should call yargs correctly', () => {
            GenerateCommand.builder(yargs);
            sinon.assert.calledOnce(yargs.options);
            sinon.assert.calledWith(yargs.options, {
                'file': {alias: 'f', required: true, describe: 'The file name/path to save the generated metadata file', type: 'string'},
                'module-path': {alias: 'p', required: false, describe: 'The path to the directory of your smart contract project which contains your chaincode, default is your current working directory', type: 'string', default: process.cwd()}
            });
            sinon.assert.calledOnce(yargs.usage);
            sinon.assert.calledWith(yargs.usage, 'fabric-chaincode-node metadata generate --file "fileName"');
        });
    });

    describe('#handler function', () => {
        let handlerStub;
        class FakeGenerate {
            static handler() {
            }
        }
        beforeEach(() => {
            handlerStub = sandbox.stub(FakeGenerate, 'handler');
            GenerateCommand.__set__('Generate', FakeGenerate);
        });

        afterEach(() => {
            sandbox.restore();
        });

        it ('should call the handler function correctly', () => {
            const argv = {random: 'something'};
            GenerateCommand.handler(argv);
            sinon.assert.calledOnce(handlerStub);
            sinon.assert.calledWithExactly(handlerStub, argv);
        });
    });
});
