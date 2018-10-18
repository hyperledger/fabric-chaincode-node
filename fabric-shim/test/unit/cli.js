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

/* global describe it beforeEach afterEach */

'use strict';

const sinon = require('sinon');

const yargs = require('yargs');

describe('fabric-chaincode-node cli', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(yargs, 'commandDir').returns(yargs);
        sandbox.stub(yargs, 'demandCommand').returns(yargs);
        sandbox.stub(yargs, 'env').returns(yargs);
        sandbox.stub(yargs, 'help').returns(yargs);
        sandbox.stub(yargs, 'wrap').returns(yargs);
        sandbox.stub(yargs, 'alias').returns(yargs);
        sandbox.stub(yargs, 'version').returns(yargs);

        sandbox.stub(process, 'exit');
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Main test', () => {
        it ('should setup yargs correctly', () => {
            sandbox.stub(yargs, 'describe').returns(yargs);
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
    });
});
