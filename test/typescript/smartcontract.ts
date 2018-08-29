/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

import {Contract, Context} from 'fabric-contract-api';

interface cpContext extends Context {
    cpList: string;
}

export default class TestContract extends Contract {

    constructor() {
        super('org.papernet.commercialpaper');

        this.setBeforeFn ( function (ctx){
            return ctx;
        }) ;
        this.setAfterFn ( function (ctx){
            return ctx;
        });
        this.setUnkownFn ( function (ctx){
            return ctx;
        });
    }

    async Transaction(ctx: Context)  {
        ctx.stub.createCompositeKey('key',[])
        ctx.clientIdentity.getID();

        this.getAfterFn();
        this.getBeforeFn();
        this.getMetadata();
        this.getUnkownFn();
        this.getNamespace();
    }
}

