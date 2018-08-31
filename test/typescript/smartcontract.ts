/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

import { Contract, Context, IntermediaryFn } from 'fabric-contract-api';
import { ChaincodeStub, ClientIdentity } from 'fabric-shim';

export default class TestContractOne extends Contract {

    constructor() {
        super('org.papernet.commercialpaper', {key: 'value'});

        const intermediaryFn: IntermediaryFn  = (ctx: Context) => {
            return ctx;
        }

        this.setBeforeFn(intermediaryFn);
        this.setAfterFn(intermediaryFn);
        this.setUnknownFn(intermediaryFn);
    }

    async Transaction(ctx: Context)  {
        const stubApi: ChaincodeStub = ctx.stub;
        const clientIdentity: ClientIdentity = ctx.clientIdentity;

        const afterFn: IntermediaryFn  = this.getAfterFn();
        const testCtxAfter: Context = afterFn(ctx);
        const beforeFn: IntermediaryFn = this.getBeforeFn();
        const testCtxBefore: Context = beforeFn(ctx);
        const unknownFn: IntermediaryFn = this.getUnknownFn();
        const testCtxUnkown: Context = beforeFn(ctx);
        const testCtx: Context = afterFn(ctx);
        const data: object = this.getMetadata();
        const ns: string = this.getNamespace();
    }
}

export class TestContractTwo extends Contract {
    constructor() {
        super('org.papernet.commercialpaper');
    }
}
