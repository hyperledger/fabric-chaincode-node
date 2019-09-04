/*
 Copyright 2018 IBM All Rights Reserved.

 SPDX-License-Identifier: Apache-2.0

*/

import * as shim from 'fabric-shim';

import { Shim,
    ChaincodeStub,
    Iterators,
    ChaincodeInterface,
    ChaincodeResponse,
    ClientIdentity,
    SplitCompositekey,
    SerializedIdentity,
    ChaincodeProposal,
    QueryResponseMetadata,
    StateQueryResponse,
    KeyEndorsementPolicy,
    ENDORSER_ROLES,
    Timestamp
 } from 'fabric-shim';

import { Logger } from 'winston';

class TestTS implements ChaincodeInterface {
    async Init(stub: ChaincodeStub): Promise<ChaincodeResponse> {
        const logger: Logger = shim.newLogger('init');
        return shim.success();
    }

    async Invoke(stub: ChaincodeStub): Promise<ChaincodeResponse> {
        const logger: Logger = Shim.newLogger('invoke');
        const args: string[] = stub.getArgs();
        const strArgs: string[] = stub.getStringArgs();
        const {fcn, params} =  stub.getFunctionAndParameters();
        const FunctionsAndParameters: {fcn: string, params: string[]} =  stub.getFunctionAndParameters();

        if (fcn === 'ThrowError') {
            const err: Error = new Error('Had a problem');
            return shim.error(Buffer.from(err.message));
        }

        if (fcn === 'ThrowErrorShim') {
            const err: Error = new Error('Had a problem');
            return Shim.error(Buffer.from(err.message));
        }

        if (fcn === 'SuccessShim') {
            return Shim.success();
        }

        await this.testAll(stub);

        if (fcn === 'nopayload') {
            return shim.success();
        }

        if (fcn === 'myReturnCode') {
            let rc: number;
            rc = ChaincodeStub.RESPONSE_CODE.OK;
            rc = shim.RESPONSE_CODE.OK;
            rc = ChaincodeStub.RESPONSE_CODE.ERRORTHRESHOLD;
            rc = shim.RESPONSE_CODE.ERRORTHRESHOLD;
            rc = ChaincodeStub.RESPONSE_CODE.ERROR;
            rc = shim.RESPONSE_CODE.ERROR;
            rc++;
        }

        return shim.success(Buffer.from('all good'));
    }

    async testAll(stub: ChaincodeStub): Promise<void> {
        this.testCompositeKey(stub);
        await this.testState(stub);
        await this.testOtherIteratorCalls(stub);
        await this.testAsyncIterators(stub);
        await this.testPrivateData(stub);
        await this.testOtherStubCalls(stub);
        this.testClientIdentity(stub);
        this.testProposal(stub);
        await this.testPagedQuery(stub);
        await this.testStateBasedEP(stub);
    }

    testCompositeKey(stub: ChaincodeStub): void {
        const key: string = stub.createCompositeKey('obj', ['a', 'b']);
        const splitKey: SplitCompositekey = stub.splitCompositeKey(key);
    }

    async testState(stub: ChaincodeStub): Promise<void> {
        const key: string = stub.createCompositeKey('obj', ['a', 'b']);
        const getState: Uint8Array = await stub.getState(key);

        let promise: Promise<void> = stub.putState(key, Buffer.from('Something'));
        await promise;
        promise = stub.deleteState(key);
        await promise;
        const compKeyIterator: Iterators.StateQueryIterator = await stub.getStateByPartialCompositeKey('obj', ['a', 'b']);
        const StateByRange: Iterators.StateQueryIterator = await stub.getStateByRange('key2', 'key6');
        const stateQIterator: Iterators.StateQueryIterator = await StateByRange;
        this.testIterator(compKeyIterator);
        this.testStateQueryIterator(compKeyIterator);
        this.testIterator(stateQIterator);
        this.testStateQueryIterator(stateQIterator);

    }

    async testPagedQuery(stub: ChaincodeStub): Promise<void> {
        let response: StateQueryResponse<Iterators.StateQueryIterator> = await stub.getStateByRangeWithPagination('key2', 'key6', 3);
        await this.testStateQueryIterator(response.iterator);
        await this.testIterator(response.iterator);
        this.testQueryResponseMetadata(response.metadata);
        response = await stub.getStateByRangeWithPagination('key2', 'key6', 3, '');
        await this.testStateQueryIterator(response.iterator);
        await this.testIterator(response.iterator);
        this.testQueryResponseMetadata(response.metadata);

        response = await stub.getStateByPartialCompositeKeyWithPagination('obj', ['a', 'b'], 10);
        await this.testStateQueryIterator(response.iterator);
        await this.testIterator(response.iterator);
        this.testQueryResponseMetadata(response.metadata);
        response = await stub.getStateByPartialCompositeKeyWithPagination('obj', ['a', 'b'], 10, 'abookmark');
        await this.testStateQueryIterator(response.iterator);
        await this.testIterator(response.iterator);
        this.testQueryResponseMetadata(response.metadata);

        response = await stub.getQueryResultWithPagination('Query string', 10);
        await this.testStateQueryIterator(response.iterator);
        await this.testIterator(response.iterator);
        this.testQueryResponseMetadata(response.metadata);
        response = await stub.getQueryResultWithPagination('Query string', 10, 'abookmark');
        await this.testStateQueryIterator(response.iterator);
        await this.testIterator(response.iterator);
        this.testQueryResponseMetadata(response.metadata);
    }

    async testOtherIteratorCalls(stub: ChaincodeStub): Promise<void> {
        const key: string = stub.createCompositeKey('obj', ['a', 'b']);
        const getHistForKey: Iterators.HistoryQueryIterator = await stub.getHistoryForKey(key);
        const queryResult: Iterators.StateQueryIterator = await stub.getQueryResult('Mango query');
        this.testIterator(getHistForKey);
        this.testHistoryQueryIterator(getHistForKey);
        this.testIterator(queryResult);
        this.testStateQueryIterator(queryResult);
    }

    async testIterator(iterator: Iterators.CommonIterator<any>) {
        const historyNext: Promise<any> = iterator.next();
        const nextVal: any = await historyNext;
        const historyClose: Promise<void> = iterator.close();
        await historyClose;
    }

    async testHistoryQueryIterator(historyQuery: Iterators.HistoryQueryIterator) {
        const historyNext: Iterators.NextKeyModificationResult = await historyQuery.next();
        await historyQuery.close();
        const done: boolean = historyNext.done;
        const keyMod: Iterators.KeyModification = historyNext.value;
        let isDelete: boolean = keyMod.isDelete;
        let timestamp: Timestamp = keyMod.timestamp;
        let txid: string = keyMod.txId;
        let value: Uint8Array = keyMod.value;
    }

    async testStateQueryIterator(stateQuery: Iterators.StateQueryIterator) {
        const stateNext: Iterators.NextResult<Iterators.KV> = await stateQuery.next();
        await stateQuery.close();
        const done: boolean = stateNext.done;
        const keyVal: Iterators.KV = stateNext.value;
        let key: string = keyVal.key;
        let val: Uint8Array = keyVal.value;
    }

    async testPrivateData(stub: ChaincodeStub): Promise<void> {
        const collection: string = 'a-collection';
        const key: string = stub.createCompositeKey('obj', ['a', 'b']);
        const value: string = 'some value';

        const privateDataByRange: Iterators.StateQueryIterator = await stub.getPrivateDataByRange(collection, key, value);
        const privateDataByPartialCompKey: Iterators.StateQueryIterator = await stub.getPrivateDataByPartialCompositeKey(collection, 'objid', ['a', 'b']);
        const privateDataQueryResult: Iterators.StateQueryIterator = await stub.getPrivateDataQueryResult(collection, value);

        const getPrivDate: Uint8Array = await stub.getPrivateData(collection, key);
        const putPrivData: Promise<void> = stub.putPrivateData(collection, key, Buffer.from(value, 'utf-8'));
        await putPrivData;
        const delPrivateData: Promise<void> = stub.deletePrivateData(collection, key);
        await delPrivateData;

    }

    async testAsyncIterators(stub: ChaincodeStub): Promise<void> {
        const iterator = stub.getStateByRange('key2', 'key6');
        for await (const res of iterator) {
            const value = res.value;
        }
        const iteratorPage = stub.getStateByRangeWithPagination('key2', 'key6', 3);
        for await (const res of iteratorPage) {
            const value = res.value;
        }
        const iteratorHistory = stub.getHistoryForKey('key1');
        for await (const res of iteratorHistory) {
            const tx_id = res.txId;
        }
    }

    async testOtherStubCalls(stub: ChaincodeStub): Promise<void> {
        const binding: string = stub.getBinding();
        const channelID: string = stub.getChannelID();
        stub.setEvent('eventid', Buffer.from('some data', 'utf-8'));
        const transient: Map<string, Uint8Array> = stub.getTransient();
        const TxID: string = stub.getTxID();
        const TxTimestamp: Timestamp = stub.getTxTimestamp();

        const creator: SerializedIdentity = stub.getCreator();
        let idbytes: Uint8Array = creator.idBytes;
        let mspid: string = creator.mspid;

        const invokeChaincode: ChaincodeResponse = await stub.invokeChaincode('ccid', ['bob', 'duck'], 'channelid');
    }

    testClientIdentity(stub: ChaincodeStub): void {
        const cID = new ClientIdentity(stub);
        const name = 'mockName';
        const value = 'mockValue';
        const attributeValue: string | null = cID.getAttributeValue(name);
        const id: string = cID.getID();
        const mspid: string = cID.getMSPID();
        const newAttributeValue: boolean = cID.assertAttributeValue(name, value);
    }

    testProposal(stub: ChaincodeStub): void {
        const proposal: ChaincodeProposal.SignedProposal = stub.getSignedProposal();
        this.testSignedProposal(proposal);
    }

    testSignedProposal(proposal: ChaincodeProposal.SignedProposal) {
        let prop: ChaincodeProposal.Proposal = proposal.proposal;
        let sig: Uint8Array = proposal.signature;

        let hdr: ChaincodeProposal.Header = prop.header;
        let payload: ChaincodeProposal.ChaincodeProposalPayload = prop.payload;

        let cHdr: ChaincodeProposal.ChannelHeader = hdr.channelHeader;
        let sHdr: ChaincodeProposal.SignatureHeader = hdr.signatureHeader;

        let chId: string = cHdr.channelId;
        let epoch: number = cHdr.epoch;
        let timestamp: Timestamp = cHdr.timestamp;
        let hash: Uint8Array = cHdr.tlsCertHash;
        let txId: string = cHdr.txId;
        let type: ChaincodeProposal.HeaderType = cHdr.type;
        let version: number = cHdr.version;

        let creator: SerializedIdentity = sHdr.creator;
        let nonce: Uint8Array = sHdr.nonce;

        let input: Uint8Array = payload.input;
        let map: Map<string, Uint8Array> = payload.transientMap;
    }

    testQueryResponseMetadata(metadata: QueryResponseMetadata) {
        const cnt: number = metadata.fetchedRecordsCount;
        const bookmark: string = metadata.bookmark;
    }

    async testStateBasedEP(stub: ChaincodeStub) {
        const ep = new KeyEndorsementPolicy();
        ep.addOrgs(ENDORSER_ROLES.MEMBER, 'Org1MSP', 'Org3MSP');
        ep.addOrgs(ENDORSER_ROLES.PEER, 'Org2MSP');
        const orgs: string[] = ep.listOrgs();
        ep.delOrgs('Org1MSP', 'Org2MSP');
        ep.delOrgs('Org3MSP');
        const policy: Uint8Array = ep.getPolicy();
        await stub.setStateValidationParameter('aKey', policy);
        await stub.setPrivateDataValidationParameter('aCollection', 'aKey', policy);

        const policy2: Uint8Array = await stub.getStateValidationParameter('aKey');
        const policy3: Uint8Array = await stub.getPrivateDataValidationParameter('aCollection', 'aKey');
        const ep2 = new KeyEndorsementPolicy(policy2);
    }
}
Shim.start(new TestTS());
