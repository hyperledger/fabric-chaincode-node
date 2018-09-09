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
/*global describe it beforeEach afterEach   */
'use strict';

// test specific libraries
const chai = require('chai');
chai.should();
const expect = chai.expect;
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
const sinon = require('sinon');



// standard utility fns
const path = require('path');

// class under test
const pathToRoot = '../../../..';

const Contract = require('fabric-contract-api').Contract;
const Context = require(path.join(pathToRoot, 'fabric-contract-api/lib/context'));
const ChaincodeFromContract = require(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/chaincodefromcontract'));
const SystemContract = require(path.join(pathToRoot, 'fabric-shim/lib/contract-spi/systemcontract'));
const shim = require(path.join(pathToRoot, 'fabric-shim/lib/chaincode'));
const FarbicStubInterface = require(path.join(pathToRoot,'fabric-shim/lib/stub'));
let alphaStub;
let betaStub;

let beforeFnStubA;
let afterFnStubA;
let unknownStub;
let privateStub;
let ctxStub;

function log(...e){
	// eslint-disable-next-line no-console
	console.log(...e);
}

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
		async alpha
		(api,arg1,arg2) {
			return alphaStub(api,arg1,arg2);
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
		}
		/**
         * @param {object} api api
         */
		beta(api) {
			betaStub(api);
		}

		async afterTransaction(ctx){
			return afterFnStubA(ctx);
		}

		async beforeTransaction(ctx){
			return beforeFnStubA(ctx);
		}

		async unknownTransaction(ctx){
			return unknownStub(ctx);
		}

		createContext(){
			return ctxStub;
		}

		_privateFunction(){
			privateStub();
		}

	}

	let sandbox;

	beforeEach('Sandbox creation', () => {
		sandbox = sinon.createSandbox();
		beforeFnStubA = sandbox.stub().named('beforeFnStubA');
		afterFnStubA = sandbox.stub().named('afterFnStubA');
		alphaStub = sandbox.stub().named('alphaStub');
		betaStub = sandbox.stub().named('betaStub');
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
				log(e);
			});
			sandbox.replace(shim,'success',fakesuccess);

			alphaStub.resolves('Hello');
			beforeFnStubA.resolves();
			afterFnStubA.resolves();

			let defaultBeforeSpy = sandbox.spy(Contract.prototype,'beforeTransaction');
			let defaultAfterSpy = sandbox.spy(Contract.prototype,'afterTransaction');
			let defaultCreateContext = sandbox.spy(Contract.prototype,'createContext');

			let cc = new ChaincodeFromContract([SCAlpha,SCBeta]);

			let stubInterface = sinon.createStubInstance(FarbicStubInterface);
			stubInterface.getFunctionAndParameters.returns({
				fcn:'alpha.alpha',
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
			sinon.assert.calledOnce(defaultBeforeSpy);
			sinon.assert.calledOnce(defaultAfterSpy);
			sinon.assert.calledOnce(defaultCreateContext);
			sinon.assert.callOrder(defaultCreateContext,defaultBeforeSpy,alphaStub,defaultAfterSpy);
			sinon.assert.calledWith(fakesuccess,'Hello');
		});

		it('should invoke the correct before/after fns function',async ()=>{
			let fakeerror = sinon.fake((e)=>{
				sinon.assert.fail(e);
			});
			sandbox.replace(shim,'error',fakeerror);
			let fakesuccess = sinon.fake((e)=>{
				log(e);
			});
			sandbox.replace(shim,'success',fakesuccess);
			beforeFnStubA.resolves();
			afterFnStubA.resolves();
			ctxStub = sandbox.createStubInstance(Context);

			let cc = new ChaincodeFromContract([SCAlpha,SCBeta]);
			// cc.createCtx = sandbox.stub().returns({});
			let stubInterface = sinon.createStubInstance(FarbicStubInterface);
			stubInterface.getFunctionAndParameters.returns({
				fcn:'beta.beta',
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
			sinon.assert.calledOnce(afterFnStubA);
			sinon.assert.calledOnce(beforeFnStubA);
			sinon.assert.callOrder(beforeFnStubA,afterFnStubA);
		});

		it('should correctly handle case of failing before hook',async ()=>{
			let fakeerror = sinon.fake((e)=>{
				log(e);

			});
			sandbox.replace(shim,'error',fakeerror);
			let fakesuccess = sinon.fake((e)=>{
				log(e);
			});
			sandbox.replace(shim,'success',fakesuccess);
			beforeFnStubA.rejects(new Error('failure failure'));
			afterFnStubA.resolves();


			let cc = new ChaincodeFromContract([SCAlpha,SCBeta]);
			// cc.createCtx = sandbox.stub().returns({});
			let stubInterface = sinon.createStubInstance(FarbicStubInterface);
			stubInterface.getFunctionAndParameters.returns({
				fcn:'beta.beta',
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

			sinon.assert.calledOnce(shim.error);
			expect(fakeerror.args[0][0]).to.be.instanceOf(Error);
			expect(fakeerror.args[0][0].toString()).to.match(/failure failure/);
			sinon.assert.notCalled(betaStub);
			sinon.assert.notCalled(afterFnStubA);

			sinon.assert.calledOnce(beforeFnStubA);

		});

		it('should throw correct error with missing namespace',async ()=>{
			let fakeerror = sinon.fake((e)=>{
				log(e);
			});
			sandbox.replace(shim,'error',fakeerror);
			let fakesuccess = sinon.fake((e)=>{
				log(e);
			});
			sandbox.replace(shim,'success',fakesuccess);

			let cc = new ChaincodeFromContract([SCAlpha,SCBeta]);
			let stubInterface = sinon.createStubInstance(FarbicStubInterface);
			stubInterface.getFunctionAndParameters.returns({
				fcn:'wibble.alpha',
				params: [   'arg1','arg2'   ]
			}  );

			await cc.Invoke(stubInterface);
			sinon.assert.calledOnce(shim.error);
			expect(fakeerror.args[0][0]).to.be.instanceOf(Error);
			expect(fakeerror.args[0][0].toString()).to.match(/Error: Namespace is not known :wibble:/);
		});

		it('should throw correct error with wrong function name',async ()=>{
			let fakeerror = sinon.fake((e)=>{
				log(e);
			});
			sandbox.replace(shim,'error',fakeerror);
			let fakesuccess = sinon.fake((e)=>{
				log(e);
			});
			sandbox.replace(shim,'success',fakesuccess);

			let cc = new ChaincodeFromContract([SCAlpha,SCBeta]);
			let stubInterface = sinon.createStubInstance(FarbicStubInterface);
			stubInterface.getFunctionAndParameters.returns({
				fcn:'alpha.wibble',
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
			sinon.assert.calledOnce(shim.error);
			expect(fakeerror.args[0][0]).to.be.instanceOf(Error);
			expect(fakeerror.args[0][0].toString()).to.match(/Error: You've asked to invoke a function that does not exist/);
		});

	});


	describe('#invoke getMetaData',()=>{

		it('should invoke getMetaData',async ()=>{
			let fakeerror = sinon.fake((e)=>{
				sinon.assert.fail(e);

			});
			sandbox.replace(shim,'error',fakeerror);
			let fakesuccess = sinon.fake((e)=>{
				log(e);
			});
			sandbox.replace(shim,'success',fakesuccess);

			alphaStub.resolves('Hello');
			beforeFnStubA.resolves();
			afterFnStubA.resolves();

			let getMetaDataSpy = sandbox.spy(SystemContract.prototype,'getMetaData');
			let getContractsSpy = sandbox.spy(ChaincodeFromContract.prototype,'getContracts');


			let cc = new ChaincodeFromContract([SCAlpha,SCBeta]);

			let stubInterface = sinon.createStubInstance(FarbicStubInterface);
			stubInterface.getFunctionAndParameters.returns({
				fcn:'org.hyperledger.fabric.getMetaData',
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

			let expectedResponse =JSON.stringify({'alpha':{'functions':['alpha']},'beta':{'functions':['beta','afterTransaction','beforeTransaction','unknownTransaction','createContext']},'org.hyperledger.fabric':{'functions':['getMetaData']}});

			await cc.Invoke(stubInterface);
			sinon.assert.calledOnce(getContractsSpy);
			sinon.assert.calledOnce(getMetaDataSpy);
			sinon.assert.calledWith(fakesuccess,expectedResponse);
		});
	});

});
