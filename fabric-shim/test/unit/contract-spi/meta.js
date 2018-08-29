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
/*global describe it beforeEach afterEach before after  */
'use strict';

// test specific libraries
const chai = require('chai');
chai.should();
const expect = chai.expect;
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
const sinon = require('sinon');
const mockery = require('mockery');


// standard utility fns
const path = require('path');

// class under test
const pathToRoot = '../../../..';
const Meta = require(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/meta'));
const Contract = require(path.join(pathToRoot, 'fabric-contract-api/lib/contract'));

describe('meta',()=>{

	let sandbox;

	beforeEach('Sandbox creation', () => {
		sandbox = sinon.createSandbox();
	});

	afterEach('Sandbox restoration', () => {
		sandbox.restore();
	});

	describe('#constructor',()=>{

		it('should create correctly',()=>{
			let meta = new Meta();
			expect(meta.getNamespace()).to.equal('org.hyperledger.fabric');
		});

	});

	describe('#getdata',()=>{

		it('should get the buffer',async ()=>{
			let meta = new Meta();
			let data = meta.getContractMetaData();
			console.log(data.toString());
			expect(data.toString()).to.equal('{}');

		});

	});

});
