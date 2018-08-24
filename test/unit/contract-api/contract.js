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
/*global describe it beforeEach afterEach  */
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
const Contract = require(path.join(pathToRoot,'fabric-contract-api/lib/contract'));


describe('contract.js',()=>{


	let sandbox;

	beforeEach('Sandbox creation',() => {
		sandbox = sinon.createSandbox();
	});

	afterEach('Sandbox restoration',() => {
		sandbox.restore();
	});

	describe('#constructor',()=>{

		it('should create with default namespace  ',()=>{
			let sc = new Contract();
			expect(sc.namespace).to.equal('contract');

			( ()=>{
				sc.unknownFn();
			}).should.throw(/does not exist/);


			// should also create default when the supplied name is empty space
			let sc1 = new Contract('');
			expect(sc1.namespace).to.equal('contract');
			expect(sc1.getNamespace()).to.equal('contract');

			let sc2 = new Contract('  ');
			expect(sc2.namespace).to.equal('contract');
			expect(sc2.getNamespace()).to.equal('contract');
		});

		it('should create with the name specified',()=>{
			let sc1 = new Contract('brain.size.planet.smart');
			expect(sc1.namespace).to.equal('brain.size.planet.smart');
			expect(sc1.getNamespace()).to.equal('brain.size.planet.smart');

			let sc2 = new Contract('   somewhat.padded.out ');
			expect(sc2.namespace).to.equal('somewhat.padded.out');
			expect(sc2.getNamespace()).to.equal('somewhat.padded.out');
		});
	});

	describe('#_isFunction',()=>{
		let sc;
		beforeEach('create temporary  contract',()=>{
			sc = new Contract();
		});

		it('should return true for functions',()=>{
			sc._isFunction((()=>{})).should.be.true;
		});

		it('should return false for not-functions',()=>{
			sc._isFunction().should.be.false;
			sc._isFunction('Hello').should.be.false;
			sc._isFunction(25).should.be.false;
			sc._isFunction(sc);
		});
	});

	describe('#set/get UnkownFn',()=>{
		let sc;
		beforeEach('create temporary  contract',()=>{
			sc = new Contract();
		});

		it('should return function passed in',()=>{
			let fn = ()=>{return 42;};
			sc.setUnknownFn(fn);
			expect(sc.unknownFn()).to.equal(42);
			expect(sc.getUnknownFn()()).to.equal(42);

		});
		it('should throw error with wrong tyupes  ',()=>{
			( ()=>{
				sc.setUnknownFn('wibble');
			}  ).should.throw(/Argument is not a function/);
		});
	});

	describe('#set/get BeforeFn',()=>{
		let sc;
		beforeEach('create temporary  contract',()=>{
			sc = new Contract();
		});

		it('should return function passed in',()=>{
			let fn = ()=>{return 42;};
			sc.setBeforeFn(fn);
			expect(sc.beforeFn()).to.equal(42);
			expect(sc.getBeforeFn()()).to.equal(42);

		});
		it('should throw error with wrong tyupes  ',()=>{
			( ()=>{
				sc.setBeforeFn('wibble');
			}  ).should.throw(/Argument is not a function/);
		});
	});

	describe('#set/get AfterFn',()=>{
		let sc;
		beforeEach('create temporary  contract',()=>{
			sc = new Contract();
		});

		it('should return function passed in',()=>{
			let fn = ()=>{return 42;};
			sc.setAfterFn(fn);
			expect(sc.afterFn()).to.equal(42);
			expect(sc.getAfterFn()()).to.equal(42);

		});
		it('should throw error with wrong tyupes  ',()=>{
			( ()=>{
				sc.setAfterFn('wibble');
			}  ).should.throw(/Argument is not a function/);
		});
	});

	describe('#getMetadata',()=>{
		let sc;
		beforeEach('create temporary  contract',()=>{
			sc = new Contract('anamespace',{a:'value',some:'othervalue'});
		});

		it('should return value passed in',()=>{
			let md = sc.getMetadata();
			expect(md).to.deep.equal({a:'value',some:'othervalue'});
		});
	});
});