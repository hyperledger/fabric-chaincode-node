/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/
declare module 'fabric-contract-api' {

    import { ChaincodeStub, ClientIdentity } from 'fabric-shim';
    export interface Context {
        stub: ChaincodeStub;
        clientIdentity: ClientIdentity;
    }

    export type IntermediaryFn = (ctx: Context) => Context;

    export class Contract {
        constructor(namespace?: string, metadata?:object);

        setUnknownFn(fn : IntermediaryFn): void;
        getUnknownFn(): IntermediaryFn;

        setBeforeFn(fn : IntermediaryFn): void;
        getBeforeFn(): IntermediaryFn;

        setAfterFn(fn : IntermediaryFn): void;
        getAfterFn(): IntermediaryFn;

        getNamespace(): string;
        getMetadata(): object;
    }
}
