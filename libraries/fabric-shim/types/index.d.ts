/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/
declare module 'fabric-shim' {

    import { Logger } from 'winston';
    import { ChannelOptions } from '@grpc/grpc-js'

    import {
        ChaincodeInterface,
        ChaincodeProposal,
        ChaincodeResponse,
        ChaincodeStub as IChaincodeStub,
        ClientIdentity as IClientIdentity,
        Iterators,
        QueryResponseMetadata,
        SerializedIdentity,
        SplitCompositekey,
        StateQueryResponse,
        Timestamp
    } from 'fabric-shim-api';

    export {
        ChaincodeInterface,
        ChaincodeProposal,
        ChaincodeResponse,
        Iterators,
        QueryResponseMetadata,
        SerializedIdentity,
        SplitCompositekey,
        StateQueryResponse,
        Timestamp
    }

    export function error(msg: Uint8Array): ChaincodeResponse;
    export function newLogger(name: string): Logger;
    export function start(chaincode: ChaincodeInterface): any;
    export function success(payload?: Uint8Array): ChaincodeResponse;

    export class Shim {
        static error(msg: Uint8Array): ChaincodeResponse;
        static newLogger(name: string): Logger;
        static start(chaincode: ChaincodeInterface): any;
        static success(payload?: Uint8Array): ChaincodeResponse;
        static server(chaincode: ChaincodeInterface, serverOpts: ChaincodeServerOpts): ChaincodeServer;
    }

    export class ChaincodeServer {
        constructor(chaincode: ChaincodeInterface, serverOpts: ChaincodeServerOpts);
        start(): Promise<void>;
    }

    type GRPCOptions = {
        [K in keyof ChannelOptions as string extends K ? never : K]?: ChannelOptions[K];
    }

    export interface ChaincodeServerOpts extends GRPCOptions {
        ccid: string;
        address: string;
        tlsProps: ChaincodeServerTLSProperties;
    }

    export interface ChaincodeServerTLSProperties {
        key: Buffer;
        cert: Buffer;
        clientCACerts: Buffer;
    }

    export class ClientIdentity implements IClientIdentity {
        constructor(stub: ChaincodeStub);
        assertAttributeValue(attrName: string, attrValue: string): boolean;
        getAttributeValue(attrName: string): string | null;
        getID(): string;
        getIDBytes(): Uint8Array;
        getMSPID(): string;
    }

    export enum RESPONSE_CODE {
        OK = 200,
        ERRORTHRESHOLD = 400,
        ERROR = 500
    }

    class ResponseCode {
        OK: number;
        ERRORTHRESHOLD: number;
        ERROR: number;
    }

    export class ChaincodeStub implements IChaincodeStub {
        getArgs(): string[];
        getStringArgs(): string[];
        getFunctionAndParameters(): { params: string[], fcn: string };

        getTxID(): string;
        getChannelID(): string;
        getCreator(): SerializedIdentity;
        getMspID(): string;
        getTransient(): Map<string, Uint8Array>;

        getSignedProposal(): ChaincodeProposal.SignedProposal;
        getTxTimestamp(): Timestamp;
        getDateTimestamp(): Date;
        getBinding(): string;

        getState(key: string): Promise<Uint8Array>;
        putState(key: string, value: Uint8Array): Promise<void>;
        deleteState(key: string): Promise<void>;
        setStateValidationParameter(key: string, ep: Uint8Array): Promise<void>;
        getStateValidationParameter(key: string): Promise<Uint8Array>;
        getStateByRange(startKey: string, endKey: string): Promise<Iterators.StateQueryIterator> & AsyncIterable<Iterators.KV>;
        getStateByRangeWithPagination(startKey: string, endKey: string, pageSize: number, bookmark?: string): Promise<StateQueryResponse<Iterators.StateQueryIterator>> & AsyncIterable<Iterators.KV>;
        getStateByPartialCompositeKey(objectType: string, attributes: string[]): Promise<Iterators.StateQueryIterator> & AsyncIterable<Iterators.KV>;
        getStateByPartialCompositeKeyWithPagination(objectType: string, attributes: string[], pageSize: number, bookmark?: string): Promise<StateQueryResponse<Iterators.StateQueryIterator>> & AsyncIterable<Iterators.KV>;

        getQueryResult(query: string): Promise<Iterators.StateQueryIterator> & AsyncIterable<Iterators.KV>;
        getQueryResultWithPagination(query: string, pageSize: number, bookmark?: string): Promise<StateQueryResponse<Iterators.StateQueryIterator>> & AsyncIterable<Iterators.KV>;
        getHistoryForKey(key: string): Promise<Iterators.HistoryQueryIterator> & AsyncIterable<Iterators.KeyModification>;

        invokeChaincode(chaincodeName: string, args: string[], channel: string): Promise<ChaincodeResponse>;
        setEvent(name: string, payload: Uint8Array): void;

        createCompositeKey(objectType: string, attributes: string[]): string;
        splitCompositeKey(compositeKey: string): SplitCompositekey;

        getPrivateData(collection: string, key: string): Promise<Uint8Array>;
        getPrivateDataHash(collection: string, key: string): Promise<Uint8Array>;
        putPrivateData(collection: string, key: string, value: Uint8Array): Promise<void>;
        deletePrivateData(collection: string, key: string): Promise<void>;
        purgePrivateData(collection: string, key: string): Promise<void>;
        setPrivateDataValidationParameter(collection: string, key: string, ep: Uint8Array): Promise<void>;
        getPrivateDataValidationParameter(collection: string, key: string): Promise<Uint8Array>;
        getPrivateDataByRange(collection: string, startKey: string, endKey: string): Promise<Iterators.StateQueryIterator> & AsyncIterable<Iterators.KV>;
        getPrivateDataByPartialCompositeKey(collection: string, objectType: string, attributes: string[]): Promise<Iterators.StateQueryIterator> & AsyncIterable<Iterators.KV>;
        getPrivateDataQueryResult(collection: string, query: string): Promise<Iterators.StateQueryIterator> & AsyncIterable<Iterators.KV>;

        static RESPONSE_CODE: ResponseCode;
    }

    export class KeyEndorsementPolicy {
        constructor(policy?: Uint8Array);
        getPolicy(): Uint8Array;
        addOrgs(role: string, ...newOrgs: string[]): void;
        delOrgs(...delOrgs: string[]): void;
        listOrgs(): string[];
    }

    export enum ENDORSER_ROLES {
        MEMBER = 'MEMBER',
        PEER = 'PEER'
    }
}
