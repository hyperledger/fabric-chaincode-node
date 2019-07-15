/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/
declare module 'fabric-shim' {

    import { Timestamp } from 'google-protobuf/google/protobuf/timestamp_pb';
    import { EventEmitter } from 'events';
    import { Logger } from 'winston';

    interface ChaincodeResponse {
        status: number;
        message: string;
        payload: Buffer;
    }

    export function error(msg: Buffer): ChaincodeResponse;
    export function newLogger(name: string): Logger;
    export function start(chaincode: ChaincodeInterface): any;
    export function success(payload?: Buffer): ChaincodeResponse;

    export class Shim {
        static error(msg: Buffer): ChaincodeResponse;
        static newLogger(name: string): Logger;
        static start(chaincode: ChaincodeInterface): any;
        static success(payload?: Buffer): ChaincodeResponse;
    }

    export class ClientIdentity {
        constructor(stub: ChaincodeStub);
        assertAttributeValue(attrName: string, attrValue: string): boolean;
        getAttributeValue(attrName: string): string | null;
        getID(): string;
        getMSPID(): string;
        getX509Certificate(): X509.Certificate;
    }

    interface SerializedIdentity {
        mspid: string;
        id_bytes: Buffer;
        getMspid(): string;
        getIdBytes(): Buffer;
    }

    interface QueryResponseMetadata {
        fetched_records_count: number;
        bookmark: string;
    }

    interface StateQueryResponse<T> {
        iterator: T;
        metadata: QueryResponseMetadata;
    }

    enum RESPONSE_CODE {
        OK = 200,
        ERRORTHRESHOLD = 400,
        ERROR = 500
    }

    class ResponseCode {
        OK: number;
        ERRORTHRESHOLD: number;
        ERROR: number;
    }

    export class ChaincodeStub {
        getArgs(): string[];
        getStringArgs(): string[];
        getFunctionAndParameters(): { params: string[], fcn: string };

        getTxID(): string;
        getChannelID(): string;
        getCreator(): SerializedIdentity;
        getTransient(): Map<string, Buffer>;

        getSignedProposal(): ChaincodeProposal.SignedProposal;
        getTxTimestamp(): Timestamp;
        getBinding(): string;

        getState(key: string): Promise<Buffer>;
        putState(key: string, value: Buffer): Promise<void>;
        deleteState(key: string): Promise<void>;
        setStateValidationParameter(key: string, ep: Buffer): Promise<void>;
        getStateValidationParameter(key: string): Promise<Buffer>;
        getStateByRange(startKey: string, endKey: string): Promise<Iterators.StateQueryIterator>;
        getStateByRangeWithPagination(startKey: string, endKey: string, pageSize: number, bookmark?: string): Promise<StateQueryResponse<Iterators.StateQueryIterator>>;
        getStateByPartialCompositeKey(objectType: string, attributes: string[]): Promise<Iterators.StateQueryIterator>;
        getStateByPartialCompositeKeyWithPagination(objectType: string, attributes: string[], pageSize: number, bookmark?: string): Promise<StateQueryResponse<Iterators.StateQueryIterator>>;

        getQueryResult(query: string): Promise<Iterators.StateQueryIterator>;
        getQueryResultWithPagination(query: string, pageSize: number, bookmark?: string): Promise<StateQueryResponse<Iterators.StateQueryIterator>>;
        getHistoryForKey(key: string): Promise<Iterators.HistoryQueryIterator>;

        invokeChaincode(chaincodeName: string, args: string[], channel: string): Promise<ChaincodeResponse>;
        setEvent(name: string, payload: Buffer): void;

        createCompositeKey(objectType: string, attributes: string[]): string;
        splitCompositeKey(compositeKey: string): SplitCompositekey;

        getPrivateData(collection: string, key: string): Promise<Buffer>;
        getPrivateDataHash(collection: string, key: string): Promise<Buffer>;
        putPrivateData(collection: string, key: string, value: Buffer): Promise<void>;
        deletePrivateData(collection: string, key: string): Promise<void>;
        setPrivateDataValidationParameter(collection: string, key: string, ep: Buffer): Promise<void>;
        getPrivateDataValidationParameter(collection: string, key: string): Promise<Buffer>;
        getPrivateDataByRange(collection: string, startKey: string, endKey: string): Promise<Iterators.StateQueryIterator>;
        getPrivateDataByPartialCompositeKey(collection: string, objectType: string, attributes: string[]): Promise<Iterators.StateQueryIterator>;
        getPrivateDataQueryResult(collection: string, query: string): Promise<Iterators.StateQueryIterator>;

        static RESPONSE_CODE: ResponseCode;
    }

    interface SplitCompositekey {
        objectType: string;
        attributes: string[];
    }

    interface ChaincodeInterface {
        Init(stub: ChaincodeStub): Promise<ChaincodeResponse>;
        Invoke(stub: ChaincodeStub): Promise<ChaincodeResponse>;
    }

    export namespace Iterators {

        interface CommonIterator extends EventEmitter {
            close(): Promise<void>;
            next(): Promise<any>;
        }

        interface HistoryQueryIterator extends CommonIterator {
            next(): Promise<NextKeyModificationResult>;
        }

        interface StateQueryIterator extends CommonIterator {
            next(): Promise<NextResult>;
        }

        interface NextResult {
            value: KV;
            done: boolean;
        }

        interface NextKeyModificationResult {
            value: KeyModification;
            done: boolean;
        }

        interface KV {
            key: string;
            value: Buffer;
            getKey(): string;
            getValue(): Buffer;
        }

        interface KeyModification {
            is_delete: boolean;
            value: Buffer;
            timestamp: Timestamp;
            tx_id: string;
            getIsDelete(): boolean;
            getValue(): Buffer;
            getTimestamp(): Timestamp;
            getTxId(): string;
        }
    }

    // This def is correct, but possibly not complete
    // for example it doesn't include extensions
    export namespace X509 {
        interface Certificate {
            subject: Subject;
            issuer: Issuer;
            notBefore: string;
            notAfter: string;
            altNames?: (string)[] | null;
            signatureAlgorithm: string;
            fingerPrint: string;
            publicKey: any;
        }

        interface Subject {
            countryName: string;
            postalCode: string;
            stateOrProvinceName: string;
            localityName: string;
            streetAddress: string;
            organizationName: string;
            organizationalUnitName: string;
            commonName: string;
        }

        interface Issuer {
            countryName: string;
            stateOrProvinceName: string;
            localityName: string;
            organizationName: string;
            commonName: string;
        }
    }

    export namespace ChaincodeProposal {
        interface SignedProposal {
            proposal_bytes: Proposal;
            getProposalBytes(): Proposal;
            signature: Buffer;
            getSignature(): Buffer;
        }

        interface Proposal {
            header: Header;
            getHeader(): Header;
            payload: ChaincodeProposalPayload;
            getPayload(): ChaincodeProposalPayload;
            extension: Buffer;
            getExtension(): Buffer;
        }

        interface Header {
            channel_header: ChannelHeader;
            getChannelHeader(): ChannelHeader;
            signature_header: SignatureHeader;
            getSignatureHeader(): SignatureHeader;
        }

        interface ChannelHeader {
            type: HeaderType;
            getType(): HeaderType;
            version: number;
            getVersion(): number;
            timestamp: Timestamp;
            getTimestamp(): Timestamp;
            channel_id: string;
            getChannelId(): string;
            tx_id: string;
            getTxId(): string;
            epoch: number;
            getEpoch(): number;
            extension: Buffer;
            getExtension(): Buffer;
            tls_cert_hash: Buffer;
            getTlsCertHash(): Buffer;
        }

        interface SignatureHeader {
            creator: SerializedIdentity;
            getCreator(): SerializedIdentity;
            nonce: Buffer;
            getNonce(): Buffer;
        }

        interface ChaincodeProposalPayload {
            input: Buffer;
            getInput(): Buffer;
            transientMap: Map<string, Buffer>;
            getTransientMap(): Map<string, Buffer>;
        }

        enum HeaderType {
            MESSAGE = 0,
            CONFIG = 1,
            CONFIG_UPDATE = 2,
            ENDORSER_TRANSACTION = 3,
            ORDERER_TRANSACTION = 4,
            DELIVER_SEEK_INFO = 5,
            CHAINCODE_PACKAGE = 6,
            PEER_ADMIN_OPERATION = 8
        }
    }

    export class KeyEndorsementPolicy {
        constructor(policy?: Buffer);
        getPolicy(): Buffer;
        addOrgs(role: string, ...newOrgs: string[]): void;
        delOrgs(...delOrgs: string[]):void;
        listOrgs(): string[];
    }

    export enum ENDORSER_ROLES {
        MEMBER = 'MEMBER',
        PEER = 'PEER'
    }
}
