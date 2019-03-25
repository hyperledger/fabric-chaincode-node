/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

import { Contract, Context } from 'fabric-contract-api';
import { ChaincodeStub, ClientIdentity } from 'fabric-shim';

export class ScenarioContext extends Context{

	customFunction():void {

	}
}

export default class TestContractOne extends Contract {

    constructor() {
        super('org.papernet.commercialpaper');
    }

	beforeTransaction(ctx: ScenarioContext){

		// test that the context super class properties are available
        const stubApi: ChaincodeStub = ctx.stub;
		const clientIdentity: ClientIdentity = ctx.clientIdentity;

		// tests that the functions in the subclasses context be called
		ctx.customFunction();

		// This proves that typescript is enforcing the
		// return type of Promise<void>
		return Promise.resolve();
	}

	afterTransaction(ctx: ScenarioContext,result: any){
		// This proves that typescript is enforcing the
		// return type of Promise<void>
		return Promise.resolve();
	}

	unknownTransaction(ctx: ScenarioContext){
		// This proves that typescript is enforcing the
		// return type of Promise<void>
		return Promise.resolve();
	}

	createContext(){
		return new ScenarioContext();
	}

    async Transaction(ctx: ScenarioContext)  {
		// test that the context super class properties are available
        const stubApi: ChaincodeStub = ctx.stub;
        const clientIdentity: ClientIdentity = ctx.clientIdentity;

		// test that the name returns a string
		const ns: string = this.getName();
		
		// add in some logging
		ctx.logging.setLevel('DEBUG');
		ctx.logging.getLogger().info('Output from the test');
    }
}

export class TestContractTwo extends Contract {
    constructor() {
        super();
	}

	async Transaction(ctx: Context)  {
        const stubApi: ChaincodeStub = ctx.stub;
        const clientIdentity: ClientIdentity = ctx.clientIdentity;
    }
}
