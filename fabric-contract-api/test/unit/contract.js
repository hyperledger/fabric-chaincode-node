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

const chai = require('chai');
chai.should();
const expect = chai.expect;
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
const sinon = require('sinon');

const path = require('path');
// class under test
const pathToRoot = '../../..';
const Contract = require(path.join(pathToRoot, 'fabric-contract-api/lib/contract'));
const Context = require(path.join(pathToRoot, 'fabric-contract-api/lib/context'));


let beforeStub;
let afterStub;
let unknownStub;
let createContextStub;

/*
* A fake  contract class;
*/
class SCAlpha extends Contract {

    /** */
    constructor() {
        super('alpha.beta.delta');

    }

    async unknownTransaction(ctx) {
        unknownStub(ctx);
    }

    async beforeTransaction(ctx) {
        beforeStub(ctx);
    }

    async afterTransaction(ctx, result) {
        afterStub(ctx, result);
    }

    createContext() {
        createContextStub();
    }
}

class SCBeta extends Contract {

    /** */
    constructor() {
        super();

    }

}

describe('contract.js', () => {

    let sandbox;

    beforeEach('Sandbox creation', () => {
        sandbox = sinon.createSandbox();
    });

    afterEach('Sandbox restoration', () => {
        sandbox.restore();
    });

    describe('#constructor', () => {

        it ('should create with default name', () => {
            const sc0 = new Contract();
            expect(sc0.getName()).to.equal('Contract');

            // should also create default when the supplied name is empty space
            const sc1 = new Contract('');
            expect(sc1.getName()).to.equal('');

            const sc2 = new Contract('  ');
            expect(sc2.getName()).to.equal('');
        });

        it ('should have default unknownTx fn', () => {
            const sc0 = new Contract();
            const ctx = {
                stub : {
                    getFunctionAndParameters: 'fn',
                    getTxID: () => {
                        return 'some id';
                    }
                }
            };

            ctx.getStub = () => {
                return ctx.stub;
            };

            ctx.stub.getFunctionAndParameters = sandbox.stub().returns({fcn:'wibble'});

            return sc0.unknownTransaction(ctx).should.eventually.be.rejectedWith(/^You've asked to invoke a function that does not exist: wibble$/);
        });

        it ('should create with the name specified', () => {
            const sc1 = new Contract('brain.size.planet.smart');
            expect(sc1.name).to.equal('brain.size.planet.smart');
            expect(sc1.getName()).to.equal('brain.size.planet.smart');

            const sc2 = new Contract('   somewhat.padded.out ');
            expect(sc2.name).to.equal('somewhat.padded.out');
            expect(sc2.getName()).to.equal('somewhat.padded.out');

            const sc3 = new SCBeta();
            expect(sc3.name).to.equal('SCBeta');
            expect(sc3.getName()).to.equal('SCBeta');
        });

        it ('should call the default before/after functions', () => {
            const sc0 = new Contract();


            return Promise.all([
                sc0.beforeTransaction().should.be.fulfilled,
                sc0.afterTransaction().should.be.fulfilled]);
        });

        it ('should call the default createContext functions', () => {
            const sc0 = new Contract();
            sc0.createContext().should.be.an.instanceOf(Context);
        });

        it ('should set the __isContract value', () => {
            const sc0 = new Contract();
            expect(sc0.__isContract).to.deep.equal(true);
        });
    });

    describe('_isContract', () => {
        it ('should return true when class is a contract', () => {
            expect(Contract._isContract(new SCAlpha())).to.deep.equal(true);
        });

        it ('should return true when class is not a contract', () => {
            class Something {}
            expect(Contract._isContract(new Something())).to.deep.equal(false);
        });

        it ('should return true when class is not instanceOf contract but does have __isContract true', () => {
            class Something {
                constructor () {
                    this.__isContract = true;
                }
            }
            expect(Contract._isContract(new Something())).to.deep.equal(true);
        });
    });

    describe('subclass specific functioning', () => {

        beforeEach('setup the stubs', () => {
            beforeStub = sandbox.stub().resolves();
            afterStub = sandbox.stub().resolves();
            unknownStub = sandbox.stub().resolves();
            createContextStub = sandbox.stub().returns();
        });

        it ('should set the correct name', () => {
            const sc = new SCAlpha();
            sc.getName().should.equal('alpha.beta.delta');
        });

        it ('should call the correct subclassed fns', () => {
            const sc = new SCAlpha();
            const ctx = 'a really simple context';
            sc.beforeTransaction(ctx);
            sinon.assert.calledOnce(beforeStub);
            sinon.assert.calledWith(beforeStub, ctx);

            sc.afterTransaction(ctx, 'result');
            sinon.assert.calledOnce(afterStub);
            sinon.assert.calledWith(afterStub, ctx, 'result');

            sc.unknownTransaction(ctx);
            sinon.assert.calledOnce(unknownStub);
            sinon.assert.calledWith(unknownStub, ctx);

            sc.createContext();
            sinon.assert.calledOnce(createContextStub);

        });
    });
});
