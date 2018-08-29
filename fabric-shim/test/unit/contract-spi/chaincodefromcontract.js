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
const bootstrap = require(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/bootstrap'));
const Contract = require(path.join(pathToRoot, 'fabric-contract-api/lib/contract'));
const ChaincodeFromContract = require(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/chaincodefromcontract'));
const shim = require(path.join(pathToRoot, 'fabric-shim/lib/chaincode'));
const FarbicStubInterface = require(path.join(pathToRoot,'fabric-shim/lib/stub'));
const alphaStub = sinon.stub().named('alphaStub');
const betaStub = sinon.stub().named('betaStub');

const beforeFnStub = sinon.stub();
const afterFnStub = sinon.stub();


const ClientIdentity = require('fabric-contract-api').ClientIdentity;
describe('chaincodefromcontract',()=>{

	/**
     * A fake  contract class;
     */
	class SCAlpha extends Contract {
		/** */
		constructor() {
			super('alpha');
		}
		/**
         * @param {object} api api
         * @param {String} arg1 arg1
         * @param {String} arg2 arg2
         */
		alpha(api,arg1,arg2) {
			alphaStub(api,arg1,arg2);
		}
	}

	/**
     * A fake  contract class;
     */
	class SCBeta extends Contract {
		/** */
		constructor() {
			super('beta');
			this.property='value';
			this.setAfterFn(afterFnStub);
			this.setBeforeFn(beforeFnStub);
		}
		/**
         * @param {object} api api
         */
		beta(api) {
			betaStub(api);
		}

	}

	let sandbox;

	beforeEach('Sandbox creation', () => {
		sandbox = sinon.createSandbox();

	});

	afterEach('Sandbox restoration', () => {
		sandbox.restore();
	});

	describe('#constructor',()=>{

		it('should handle no classes being past in',()=>{
			(()=>{
				new ChaincodeFromContract();
			}).should.throw(/Missing argument/);
		});

		it('should handle classes that are not of the correc type',()=>{
			let tempClass =   class{
				/**  */
				constructor(){}
			};

			(()=>{
				new ChaincodeFromContract([
					tempClass
				]);
			}).should.throw(/invalid contract/);
		});

		it('should correctly create valid chaincode instance',()=>{
			SCBeta.prototype.fred='fred';
			let cc = new ChaincodeFromContract([SCAlpha,SCBeta]);

			// get the contracts that have been defined
			expect(cc.contracts).to.have.keys('alpha','beta','org.hyperledger.fabric');
			expect(cc.contracts.alpha).to.include.keys('functionNames');
			expect(cc.contracts.beta).to.include.keys('functionNames');
			expect(cc.contracts.beta.functionNames).to.include('beta');
			expect(cc.contracts.alpha.functionNames).to.include('alpha');
		});

	});

	describe('#init',()=>{

		it('should call the Invoke method',async ()=>{
			let stubFake = {};

			let cc = new ChaincodeFromContract([SCAlpha,SCBeta]);
			sandbox.stub(cc,'Invoke');
			await cc.Init(stubFake);

			sinon.assert.calledOnce(cc.Invoke);
			sinon.assert.calledWith(cc.Invoke,stubFake);

		});

	});

	describe('#invoke',()=>{

		it('should invoke the alpha function',async ()=>{
			let fakeerror = sinon.fake((e)=>{
				sinon.assert.fail(e);

			});
			sandbox.replace(shim,'error',fakeerror);
			let fakesuccess = sinon.fake((e)=>{

			});
			sandbox.replace(shim,'success',fakesuccess);

			let cc = new ChaincodeFromContract([SCAlpha,SCBeta]);
			// cc.createCtx = sandbox.stub().returns({});
			let stubInterface = sinon.createStubInstance(FarbicStubInterface);
			stubInterface.getFunctionAndParameters.returns({
				fcn:'alpha_alpha',
				params: [   'arg1','arg2'   ]
			}  );
			const certWithoutAttrs = '-----BEGIN CERTIFICATE-----' +
			'MIICXTCCAgSgAwIBAgIUeLy6uQnq8wwyElU/jCKRYz3tJiQwCgYIKoZIzj0EAwIw' +
			'eTELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNh' +
			'biBGcmFuY2lzY28xGTAXBgNVBAoTEEludGVybmV0IFdpZGdldHMxDDAKBgNVBAsT' +
			'A1dXVzEUMBIGA1UEAxMLZXhhbXBsZS5jb20wHhcNMTcwOTA4MDAxNTAwWhcNMTgw' +
			'OTA4MDAxNTAwWjBdMQswCQYDVQQGEwJVUzEXMBUGA1UECBMOTm9ydGggQ2Fyb2xp' +
			'bmExFDASBgNVBAoTC0h5cGVybGVkZ2VyMQ8wDQYDVQQLEwZGYWJyaWMxDjAMBgNV' +
			'BAMTBWFkbWluMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEFq/90YMuH4tWugHa' +
			'oyZtt4Mbwgv6CkBSDfYulVO1CVInw1i/k16DocQ/KSDTeTfgJxrX1Ree1tjpaodG' +
			'1wWyM6OBhTCBgjAOBgNVHQ8BAf8EBAMCB4AwDAYDVR0TAQH/BAIwADAdBgNVHQ4E' +
			'FgQUhKs/VJ9IWJd+wer6sgsgtZmxZNwwHwYDVR0jBBgwFoAUIUd4i/sLTwYWvpVr' +
			'TApzcT8zv/kwIgYDVR0RBBswGYIXQW5pbHMtTWFjQm9vay1Qcm8ubG9jYWwwCgYI' +
			'KoZIzj0EAwIDRwAwRAIgCoXaCdU8ZiRKkai0QiXJM/GL5fysLnmG2oZ6XOIdwtsC' +
			'IEmCsI8Mhrvx1doTbEOm7kmIrhQwUVDBNXCWX1t3kJVN' +
			'-----END CERTIFICATE-----';
			let idBytes = {
				toBuffer: ()=>{return new Buffer(certWithoutAttrs);}
			};

			let mockSigningId = {
				getMspid: sinon.stub(),
				getIdBytes: sinon.stub().returns(idBytes)
			};
			stubInterface.getCreator.returns(
				mockSigningId
			);


			await cc.Invoke(stubInterface);
			sinon.assert.calledOnce(alphaStub);
			sinon.assert.calledWith(alphaStub,sinon.match.any,'arg1','arg2');
		});

		it('should invoke the correct before/after fns function',async ()=>{
			let fakeerror = sinon.fake((e)=>{
				sinon.assert.fail(e);

			});
			sandbox.replace(shim,'error',fakeerror);
			let fakesuccess = sinon.fake((e)=>{

			});
			sandbox.replace(shim,'success',fakesuccess);

			let cc = new ChaincodeFromContract([SCAlpha,SCBeta]);
			// cc.createCtx = sandbox.stub().returns({});
			let stubInterface = sinon.createStubInstance(FarbicStubInterface);
			stubInterface.getFunctionAndParameters.returns({
				fcn:'beta_beta',
				params: [   'arg1','arg2'   ]
			}  );
			const certWithoutAttrs = '-----BEGIN CERTIFICATE-----' +
			'MIICXTCCAgSgAwIBAgIUeLy6uQnq8wwyElU/jCKRYz3tJiQwCgYIKoZIzj0EAwIw' +
			'eTELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNh' +
			'biBGcmFuY2lzY28xGTAXBgNVBAoTEEludGVybmV0IFdpZGdldHMxDDAKBgNVBAsT' +
			'A1dXVzEUMBIGA1UEAxMLZXhhbXBsZS5jb20wHhcNMTcwOTA4MDAxNTAwWhcNMTgw' +
			'OTA4MDAxNTAwWjBdMQswCQYDVQQGEwJVUzEXMBUGA1UECBMOTm9ydGggQ2Fyb2xp' +
			'bmExFDASBgNVBAoTC0h5cGVybGVkZ2VyMQ8wDQYDVQQLEwZGYWJyaWMxDjAMBgNV' +
			'BAMTBWFkbWluMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEFq/90YMuH4tWugHa' +
			'oyZtt4Mbwgv6CkBSDfYulVO1CVInw1i/k16DocQ/KSDTeTfgJxrX1Ree1tjpaodG' +
			'1wWyM6OBhTCBgjAOBgNVHQ8BAf8EBAMCB4AwDAYDVR0TAQH/BAIwADAdBgNVHQ4E' +
			'FgQUhKs/VJ9IWJd+wer6sgsgtZmxZNwwHwYDVR0jBBgwFoAUIUd4i/sLTwYWvpVr' +
			'TApzcT8zv/kwIgYDVR0RBBswGYIXQW5pbHMtTWFjQm9vay1Qcm8ubG9jYWwwCgYI' +
			'KoZIzj0EAwIDRwAwRAIgCoXaCdU8ZiRKkai0QiXJM/GL5fysLnmG2oZ6XOIdwtsC' +
			'IEmCsI8Mhrvx1doTbEOm7kmIrhQwUVDBNXCWX1t3kJVN' +
			'-----END CERTIFICATE-----';
			let idBytes = {
				toBuffer: ()=>{return new Buffer(certWithoutAttrs);}
			};

			let mockSigningId = {
				getMspid: sinon.stub(),
				getIdBytes: sinon.stub().returns(idBytes)
			};
			stubInterface.getCreator.returns(
				mockSigningId
			);


			await cc.Invoke(stubInterface);
			sinon.assert.calledOnce(betaStub);
			sinon.assert.calledOnce(afterFnStub);
			sinon.assert.calledOnce(beforeFnStub);
		});

		it('should throw correct error with missing namespace',async ()=>{
			let fakeerror = sinon.fake((e)=>{
				console.log(e);
			});
			sandbox.replace(shim,'error',fakeerror);
			let fakesuccess = sinon.fake((e)=>{
				console.log(e);
			});
			sandbox.replace(shim,'success',fakesuccess);

			let cc = new ChaincodeFromContract([SCAlpha,SCBeta]);
			let stubInterface = sinon.createStubInstance(FarbicStubInterface);
			stubInterface.getFunctionAndParameters.returns({
				fcn:'wibble_alpha',
				params: [   'arg1','arg2'   ]
			}  );

			await cc.Invoke(stubInterface);
			sinon.assert.calledOnce(shim.error);
			expect(fakeerror.args[0][0]).to.be.instanceOf(Error);
			expect(fakeerror.args[0][0].toString()).to.match(/Error: Namespace is not known :wibble:/);
		});

		it('should throw correct error with wrong function name',async ()=>{
			let fakeerror = sinon.fake((e)=>{
				console.log(e);
			});
			sandbox.replace(shim,'error',fakeerror);
			let fakesuccess = sinon.fake((e)=>{
				console.log(e);
			});
			sandbox.replace(shim,'success',fakesuccess);

			let cc = new ChaincodeFromContract([SCAlpha,SCBeta]);
			let stubInterface = sinon.createStubInstance(FarbicStubInterface);
			stubInterface.getFunctionAndParameters.returns({
				fcn:'alpha_wibble',
				params: [   'arg1','arg2'   ]
			}  );

			await cc.Invoke(stubInterface);
			sinon.assert.calledOnce(shim.error);
			expect(fakeerror.args[0][0]).to.be.instanceOf(Error);
			expect(fakeerror.args[0][0].toString()).to.match(/Error: No contract function wibble/);
		});

	});

});
