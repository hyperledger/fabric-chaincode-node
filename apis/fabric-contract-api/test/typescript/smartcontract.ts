/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

import { Contract, Context } from 'fabric-contract-api';
import { ChaincodeStub, ClientIdentity } from 'fabric-shim-api';

export class ScenarioContext extends Context {
    customFunction(): void {}
}

export default class TestContractOne extends Contract {
    constructor() {
        super('org.papernet.commercialpaper');
    }

    beforeTransaction(ctx: ScenarioContext): Promise<void> {
        // test that the context super class properties are available
        const stubApi: ChaincodeStub = ctx.stub;
        const clientIdentity: ClientIdentity = ctx.clientIdentity;

        // tests that the functions in the subclasses context be called
        ctx.customFunction();

        // This proves that typescript is enforcing the
        // return type of Promise<void>
        return Promise.resolve();
    }

    afterTransaction(ctx: ScenarioContext, result: any): Promise<void> {
        // This proves that typescript is enforcing the
        // return type of Promise<void>
        return Promise.resolve();
    }

    aroundTransaction(
        ctx: ScenarioContext,
        fn: Function,
        parameters: any
    ): Promise<void> {
        // This proves that typescript is enforcing the
        // return type of Promise<void>
        return super.aroundTransaction(ctx, fn, parameters);
    }

    unknownTransaction(ctx: ScenarioContext): Promise<void> {
        // This proves that typescript is enforcing the
        // return type of Promise<void>
        return Promise.resolve();
    }

    createContext(): ScenarioContext {
        return new ScenarioContext();
    }

    async Transaction(ctx: ScenarioContext): Promise<void> {
        // test that the context super class properties are available
        const stubApi: ChaincodeStub = ctx.stub;
        const clientIdentity: ClientIdentity = ctx.clientIdentity;

        // test that the name returns a string
        const ns: string = this.getName();
    }
}

export class TestContractTwo extends Contract {
    constructor() {
        super();
    }

    async Transaction(ctx: Context): Promise<void> {
        const stubApi: ChaincodeStub = ctx.stub;
        const clientIdentity: ClientIdentity = ctx.clientIdentity;
    }
}
