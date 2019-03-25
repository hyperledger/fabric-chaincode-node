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
    X509,
    SplitCompositekey,
    SerializedIdentity,
    ChaincodeProposal,
    QueryResponseMetadata,
    StateQueryResponse,
    KeyEndorsementPolicy,
    ENDORSER_ROLES,
 } from 'fabric-shim';

import { Timestamp } from 'google-protobuf/google/protobuf/timestamp_pb';
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
        const getState: Buffer = await stub.getState(key);

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

    async testIterator(iterator: Iterators.CommonIterator) {
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
        let isDelete: boolean = keyMod.is_delete;
        isDelete = keyMod.getIsDelete();
        let timestamp: Timestamp = keyMod.timestamp;
        timestamp = keyMod.getTimestamp();
        let txid: string = keyMod.tx_id;
        txid = keyMod.getTxId();
        let value: Buffer = keyMod.value;
        value = keyMod.getValue();
    }

    async testStateQueryIterator(stateQuery: Iterators.StateQueryIterator) {
        const stateNext: Iterators.NextResult = await stateQuery.next();
        await stateQuery.close();
        const done: boolean = stateNext.done;
        const keyVal: Iterators.KV = stateNext.value;
        let key: string = keyVal.key;
        key = keyVal.getKey();
        let val: Buffer = keyVal.value;
        val = keyVal.getValue();
    }

    async testPrivateData(stub: ChaincodeStub): Promise<void> {
        const collection: string = 'a-collection';
        const key: string = stub.createCompositeKey('obj', ['a', 'b']);
        const value: string = 'some value';

        const privateDataByRange: Iterators.StateQueryIterator = await stub.getPrivateDataByRange(collection, key, value);
        const privateDataByPartialCompKey: Iterators.StateQueryIterator = await stub.getPrivateDataByPartialCompositeKey(collection, 'objid', ['a', 'b']);
        const privateDataQueryResult: Iterators.StateQueryIterator = await stub.getPrivateDataQueryResult(collection, value);

        const getPrivDate: Buffer = await stub.getPrivateData(collection, key);
        const putPrivData: Promise<void> = stub.putPrivateData(collection, key, Buffer.from(value, 'utf-8'));
        await putPrivData;
        const delPrivateData: Promise<void> = stub.deletePrivateData(collection, key);
        await delPrivateData;

    }

    async testOtherStubCalls(stub: ChaincodeStub): Promise<void> {
        const binding: string = stub.getBinding();
        const channelID: string = stub.getChannelID();
        stub.setEvent('eventid', Buffer.from('some data', 'utf-8'));
        const transient: Map<string, Buffer> = stub.getTransient();
        const TxID: string = stub.getTxID();
        const TxTimestamp: Timestamp = stub.getTxTimestamp();

        const creator: SerializedIdentity = stub.getCreator();
        let idbytes: Buffer = creator.getIdBytes();
        idbytes = creator.id_bytes;
        let mspid: string = creator.mspid;
        mspid = creator.getMspid();

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
        const X509Certificate: X509.Certificate = cID.getX509Certificate();
        this.testCert(X509Certificate);
    }

    testCert(cert: X509.Certificate) {
        const subject: X509.Subject = cert.subject;
        const issuer: X509.Issuer = cert.issuer;
        const notAfter: string = cert.notAfter;
        const notBefore: string = cert.notBefore;
        const fingerPrint: string = cert.fingerPrint;
        const publicKey: string = cert.publicKey;
        const sigAlg: string = cert.signatureAlgorithm;

        let commonName: string = issuer.commonName;
        let countryName: string = issuer.countryName;
        let localityName: string = issuer.localityName;
        let organisationName: string = issuer.organizationName;
        let stateOrProvinceName: string = issuer.stateOrProvinceName;

        stateOrProvinceName = subject.stateOrProvinceName;
        commonName = subject.commonName;
        countryName = subject.countryName;
        localityName = subject.localityName;
        organisationName = subject.organizationName;
        const organisationalUnitName: string = subject.organizationalUnitName;
        const postcode: string = subject.postalCode;
        const stateName: string = subject.stateOrProvinceName;
        const address: string = subject.streetAddress;
    }

    testProposal(stub: ChaincodeStub): void {
        const proposal: ChaincodeProposal.SignedProposal = stub.getSignedProposal();
        this.testSignedProposal(proposal);
    }

    testSignedProposal(proposal: ChaincodeProposal.SignedProposal) {
        let prop: ChaincodeProposal.Proposal = proposal.proposal_bytes;
        let sig: Buffer = proposal.signature;
        prop = proposal.getProposalBytes();
        sig = proposal.getSignature();

        let ext: Buffer = prop.extension;
        ext = prop.getExtension();
        let hdr: ChaincodeProposal.Header = prop.header;
        hdr = prop.getHeader();
        let payload: ChaincodeProposal.ChaincodeProposalPayload = prop.payload;
        payload = prop.getPayload();

        let cHdr: ChaincodeProposal.ChannelHeader = hdr.channel_header;
        cHdr = hdr.getChannelHeader();
        let sHdr: ChaincodeProposal.SignatureHeader = hdr.signature_header;
        sHdr = hdr.getSignatureHeader();

        let chId: string = cHdr.channel_id;
        chId = cHdr.getChannelId();
        let epoch: number = cHdr.epoch;
        epoch = cHdr.getEpoch();
        ext = cHdr.extension;
        ext = cHdr.getExtension();
        let timestamp: Timestamp = cHdr.timestamp;
        timestamp = cHdr.getTimestamp();
        let hash: Buffer = cHdr.tls_cert_hash;
        hash = cHdr.getTlsCertHash();
        let txId: string = cHdr.tx_id;
        txId = cHdr.getTxId();
        let type: ChaincodeProposal.HeaderType = cHdr.type;
        type = cHdr.getType();
        let version: number = cHdr.version;
        version = cHdr.getVersion();

        let creator: SerializedIdentity = sHdr.creator;
        creator = sHdr.getCreator();
        let nonce: Buffer = sHdr.nonce;
        nonce = sHdr.getNonce();

        let input: Buffer = payload.input;
        input = payload.getInput();
        let map: Map<string, Buffer> = payload.transientMap;
        map = payload.getTransientMap();
    }

    testQueryResponseMetadata(metadata: QueryResponseMetadata) {
        const cnt: number = metadata.fetched_records_count;
        const bookmark: string = metadata.bookmark;
    }

    async testStateBasedEP(stub: ChaincodeStub) {
        const ep = new KeyEndorsementPolicy();
        ep.addOrgs(ENDORSER_ROLES.MEMBER, 'Org1MSP', 'Org3MSP');
        ep.addOrgs(ENDORSER_ROLES.PEER, 'Org2MSP');
        const orgs: string[] = ep.listOrgs();
        ep.delOrgs('Org1MSP', 'Org2MSP');
        ep.delOrgs('Org3MSP');
        const policy: Buffer = ep.getPolicy();
        await stub.setStateValidationParameter('aKey', policy);
        await stub.setPrivateDataValidationParameter('aCollection', 'aKey', policy);

        const policy2: Buffer = await stub.getStateValidationParameter('aKey');
        const policy3: Buffer = await stub.getPrivateDataValidationParameter('aCollection', 'aKey');
        const ep2 = new KeyEndorsementPolicy(policy2);
    }
}
Shim.start(new TestTS());
