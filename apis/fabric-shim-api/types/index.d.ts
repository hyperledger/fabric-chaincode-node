/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/
declare module 'fabric-shim-api' {

    interface Timestamp {
        seconds: number;
        nanos: number;
    }

    interface ChaincodeResponse {
        status: number;
        message: string;
        payload: Uint8Array;
    }

    interface ClientIdentity {
        assertAttributeValue(attrName: string, attrValue: string): boolean;
        getAttributeValue(attrName: string): string | null;
        getID(): string;
        getIDBytes(): Uint8Array;
        getMSPID(): string;
    }

    interface SerializedIdentity {
        mspid: string;
        idBytes: Uint8Array;
    }

    interface QueryResponseMetadata {
        fetchedRecordsCount: number;
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

    interface ChaincodeStub {
        getArgs(): string[];
        getStringArgs(): string[];
        getFunctionAndParameters(): { params: string[], fcn: string };

        getTxID(): string;
        getChannelID(): string;
        getCreator(): SerializedIdentity;
        getMSPID(): string;
        getTransient(): Map<string, Uint8Array>;

        getSignedProposal(): ChaincodeProposal.SignedProposal;
        getTxTimestamp(): Timestamp;
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
        setPrivateDataValidationParameter(collection: string, key: string, ep: Uint8Array): Promise<void>;
        getPrivateDataValidationParameter(collection: string, key: string): Promise<Uint8Array>;
        getPrivateDataByRange(collection: string, startKey: string, endKey: string): Promise<Iterators.StateQueryIterator> & AsyncIterable<Iterators.KV>;
        getPrivateDataByPartialCompositeKey(collection: string, objectType: string, attributes: string[]): Promise<Iterators.StateQueryIterator> & AsyncIterable<Iterators.KV>;
        getPrivateDataQueryResult(collection: string, query: string): Promise<Iterators.StateQueryIterator> & AsyncIterable<Iterators.KV>;
    }

    interface SplitCompositekey {
        objectType: string;
        attributes: string[];
    }

    interface ChaincodeInterface {
        Init(stub: ChaincodeStub): Promise<ChaincodeResponse>;
        Invoke(stub: ChaincodeStub): Promise<ChaincodeResponse>;
    }

    namespace Iterators {

        interface CommonIterator<T> {
            close(): Promise<void>;
            next(): Promise<NextResult<T>>;
        }

        interface NextResult<T> {
            value: T;
            done: boolean;
        }

        type HistoryQueryIterator = CommonIterator<KeyModification>;
        type StateQueryIterator = CommonIterator<KV>;

        interface NextKeyModificationResult {
            value: KeyModification;
            done: boolean;
        }

        interface KV {
            namespace: string;
            key: string;
            value: Uint8Array;
        }

        interface KeyModification {
            isDelete: boolean;
            value: Uint8Array;
            timestamp: Timestamp;
            txId: string;
        }
    }

    namespace ChaincodeProposal {
        interface SignedProposal {
            proposal: Proposal;
            signature: Uint8Array;
        }

        interface Proposal {
            header: Header;
            payload: ChaincodeProposalPayload;
        }

        interface Header {
            channelHeader: ChannelHeader;
            signatureHeader: SignatureHeader;
        }

        interface ChannelHeader {
            type: HeaderType;
            version: number;
            timestamp: Timestamp;
            channelId: string;
            txId: string;
            epoch: number;
            extension: Uint8Array;
            tlsCertHash: Uint8Array;
        }

        interface SignatureHeader {
            creator: SerializedIdentity;
            nonce: Uint8Array;
        }

        interface ChaincodeProposalPayload {
            input: Uint8Array;
            transientMap: Map<string, Uint8Array>;
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

}
