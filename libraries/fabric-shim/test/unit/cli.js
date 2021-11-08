/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* global describe it beforeEach afterEach */

'use strict';

const sinon = require('sinon');

const yargs = require('yargs');

const {execSync} = require('child_process');

describe('fabric-chaincode-node cli', () => {
    let sandbox;

    beforeEach(() => {

        sandbox = sinon.createSandbox();
        sandbox.stub(yargs, 'parserConfiguration').returns(yargs);
        sandbox.stub(yargs, 'commandDir').returns(yargs);
        sandbox.stub(yargs, 'demandCommand').returns(yargs);

        sandbox.stub(yargs, 'help').returns(yargs);
        sandbox.stub(yargs, 'wrap').returns(yargs);
        sandbox.stub(yargs, 'alias').returns(yargs);
        sandbox.stub(yargs, 'version').returns(yargs);

        sandbox.stub(process, 'exit');
        execSync('cp ./cli.js ./cli2.js', () => {});
        execSync('sed 1d ./cli2.js > ./cli.js', () => {});
    });

    afterEach(() => {
        sandbox.restore();
        delete require.cache[require.resolve('../../cli.js')];
        execSync('rm ./cli.js', () => {});
        execSync('mv ./cli2.js ./cli.js', () => {});
    });

    describe('Main test', () => {
        it('should setup yargs correctly', () => {
            sandbox.stub(yargs, 'describe').returns(yargs);
            sandbox.stub(yargs, 'env').returns(yargs);

            require('../../cli.js');

            sinon.assert.calledOnce(yargs.commandDir);
            sinon.assert.calledWith(yargs.commandDir, './lib/cmds');
            sinon.assert.calledOnce(yargs.demandCommand);
            sinon.assert.calledOnce(yargs.help);
            sinon.assert.calledOnce(yargs.wrap);
            sinon.assert.calledOnce(yargs.alias);
            sinon.assert.calledOnce(yargs.version);
            sinon.assert.calledOnce(yargs.describe);
            sinon.assert.calledOnce(yargs.env);
            sinon.assert.calledWith(yargs.env, 'CORE');
        });

        it('should handle resolved promise  correctly', () => {
            sandbox.stub(yargs, 'describe').returns(yargs);
            sandbox.stub(yargs, 'env').resolves("");
            require('../../cli.js');
        });

        it('should handle rejected promise  correctly', () => {
            sandbox.stub(yargs, 'describe').returns(yargs);
            sandbox.stub(yargs, 'env').throws("Test Failure")

            require('../../cli.js');
        });
    });
});
