/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const MetadataCommand = require('../../../lib/cmds/metadata');
const yargs = require('yargs');
require('chai').should();
const chai = require('chai');
const sinon = require('sinon');
chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

describe('fabric-chaincode-node metadata cmd launcher', function () {
    let sandbox;

    beforeEach(() => {

        sandbox = sinon.createSandbox();
        sandbox.stub(yargs, 'usage').returns(yargs);
        sandbox.stub(yargs, 'options').returns(yargs);
        sandbox.stub(yargs, 'requiresArg').returns(yargs);
        sandbox.stub(yargs, 'demandCommand').returns(yargs);
        sandbox.stub(yargs, 'commandDir');
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('cmd method tests', () => {

        it ('should have the correct command and description', function () {
            MetadataCommand.command.should.include('metadata');
            MetadataCommand.desc.should.include('metadata');
        });

        it ('should call yargs correctly', () => {
            MetadataCommand.builder(yargs);
            sinon.assert.calledOnce(yargs.commandDir);
            sinon.assert.calledWith(yargs.commandDir, 'metadata');
            MetadataCommand.handler();
        });

    });


});
