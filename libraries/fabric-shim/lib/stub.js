/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

// TODO: Need to add parameter validation to all calls.
'use strict';

const {msp, peer, common} = require('@hyperledger/fabric-protos');

const util = require('util');
const crypto = require('crypto');
const {ChaincodeEvent} = require('@hyperledger/fabric-protos/lib/peer');
const Long = require('long');

const logger = require('./logger').getLogger('lib/stub.js');

const VALIDATION_PARAMETER = 'VALIDATION_PARAMETER';

const RESPONSE_CODE = {
    // OK constant - status code less than 400, endorser will endorse it.
    // OK means init or invoke successfully.
    OK: 200,

    // ERRORTHRESHOLD constant - status code greater than or equal to 400 will be considered an error and rejected by endorser.
    ERRORTHRESHOLD: 400,

    // ERROR constant - default error value
    ERROR: 500
};

const MIN_UNICODE_RUNE_VALUE = '\u0000';
const MAX_UNICODE_RUNE_VALUE = '\u{10ffff}';
const COMPOSITEKEY_NS = '\x00';
const EMPTY_KEY_SUBSTITUTE = '\x01';

function validateCompositeKeyAttribute(attr) {
    if (!attr || typeof attr !== 'string' || attr.length === 0) {
        throw new Error('object type or attribute not a non-zero length string');
    }
}

// To ensure that simple keys do not go into composite key namespace,
// we validate simplekey to check whether the key starts with 0x00 (which
// is the namespace for compositeKey). This helps in avoding simple/composite
// key collisions.
function validateSimpleKeys(...keys) {
    keys.forEach((key) => {
        if (key && typeof key === 'string' && key.charAt(0) === COMPOSITEKEY_NS) {
            throw new Error(`first character of the key [${key}] contains a null character which is not allowed`);
        }
    });
}

function computeProposalBinding(decodedSP) {
    const nonce = decodedSP.proposal.header.signatureHeader.nonce;
    const creator = decodedSP.proposal.header.signatureHeader.creator_u8;
    const epoch = decodedSP.proposal.header.channelHeader.getEpoch();

    // see github.com/hyperledger/fabric/protos/utils/proputils.go, computeProposalBindingInternal()

    // the epoch will be encoded as little endian bytes of 8
    // it's a Long number with high and low values (since JavaScript only supports
    // 32bit unsigned integers)
    const buf = Buffer.allocUnsafe(8);
    buf.writeUInt32LE(epoch.low, 0);
    buf.writeUInt32LE(epoch.high, 4);

    const total = Buffer.concat([nonce, creator, buf], nonce.length + creator.length + 8);

    const hash = crypto.createHash('sha256');
    hash.update(total);
    return hash.digest('hex');
}

// Construct the QueryMetadata with a page size and a bookmark needed for pagination
function createQueryMetadata(pageSize, bookmark) {
    const queryPb = new peer.QueryMetadata();
    queryPb.setPagesize(pageSize);
    queryPb.setBookmark(bookmark);
    return queryPb.serializeBinary();
}

// function to convert a promise that either will resolve to an iterator or an object
// that contains an iterator in the `iterator` property field into an async iterable
// isActualIterator declares whether the promise will resolve to an actual iterator
// or an object containing the iterator
function convertToAsyncIterator(promise) {
    promise[Symbol.asyncIterator] = () => {
        let iterator;
        return {
            next: async () => {
                if (!iterator) {
                    const response = await promise;
                    // determine if we get the actual iterator or an object
                    // that contains the iterator as a property.
                    iterator = response.iterator ? response.iterator : response;  // eslint-disable-line require-atomic-updates
                }
                const nextVal = await iterator.next();
                if (nextVal.done) {
                    logger.debug('iterator automatically closed as all values retrieved');
                    await iterator.close();
                }
                return nextVal;
            },
            return: async () => {
                // cannot come up with a for/of scenario where return
                // might be called without next being called first so
                // assume that iterator will have been set. If promise
                // get's rejected in next then return isn't called either.
                logger.debug('iterator closed as exited from loop before completion');
                await iterator.close();
                return {done: true};
            }
        };
    };
    return promise;
}

/**
 * The ChaincodeStub is implemented by the <code>fabric-shim</code>
 * library and passed to the {@link ChaincodeInterface} calls by the Hyperledger Fabric platform.
 * The stub encapsulates the APIs between the chaincode implementation and the Fabric peer
 * @class
 * @memberof fabric-shim
 * @hideconstructor
 */
class ChaincodeStub {
    /**
     * @hideconstructor
     * @param {Handler} client an instance of the Handler class
     * @param {string} channel_id channel id
     * @param {string} txId transaction id
     * @param {any} chaincodeInput decoded message from peer
     * @param {any} signedProposalpb the proposal protobuf
     */
    constructor(client, channel_id, txId, chaincodeInput, signedProposalPb) {
        this.channel_id = channel_id;
        this.txId = txId;
        this.bufferArgs = chaincodeInput.getArgsList_asU8().map((arg) => Buffer.from(arg));
        this.args = this.bufferArgs.map((arg) => arg.toString());

        this.handler = client;
        this.validationParameterMetakey = VALIDATION_PARAMETER;

        if (signedProposalPb) {
            const decodedSP = {
                signature: signedProposalPb.getSignature()
            };

            let proposal;
            try {
                proposal = peer.Proposal.deserializeBinary(signedProposalPb.getProposalBytes());
                decodedSP.proposal = {};
                this.proposal = proposal;
            } catch (err) {
                throw new Error(util.format('Failed extracting proposal from signedProposal. [%s]', err));
            }

            const proposalHeader = proposal.getHeader_asU8();
            if (!proposalHeader || proposalHeader.length === 0) {
                throw new Error('Proposal header is empty');
            }

            const proposalPayload = proposal.getPayload_asU8();
            if (!proposalPayload || proposalPayload.length === 0) {
                throw new Error('Proposal payload is empty');
            }

            let header;
            try {
                header = common.Header.deserializeBinary(proposalHeader);
                decodedSP.proposal.header = {};
            } catch (err) {
                throw new Error(util.format('Could not extract the header from the proposal: %s', err));
            }

            let signatureHeader;
            try {
                signatureHeader = common.SignatureHeader.deserializeBinary(header.getSignatureHeader());
                decodedSP.proposal.header.signatureHeader = {nonce: signatureHeader.getNonce_asU8(), creator_u8: signatureHeader.getCreator_asU8()};
            } catch (err) {
                throw new Error(util.format('Decoding SignatureHeader failed: %s', err));
            }

            let creator;
            try {
                creator = msp.SerializedIdentity.deserializeBinary(signatureHeader.getCreator_asU8());
                decodedSP.proposal.header.signatureHeader.creator = creator;
                this.creator = {mspid: creator.getMspid(), idBytes: creator.getIdBytes_asU8()};
            } catch (err) {
                throw new Error(util.format('Decoding SerializedIdentity failed: %s', err));
            }

            let channelHeader;
            try {
                channelHeader = common.ChannelHeader.deserializeBinary(header.getChannelHeader_asU8());
                decodedSP.proposal.header.channelHeader = channelHeader;
                this.txTimestamp = channelHeader.getTimestamp();
            } catch (err) {
                throw new Error(util.format('Decoding ChannelHeader failed: %s', err));
            }

            let ccpp;
            try {
                ccpp = peer.ChaincodeProposalPayload.deserializeBinary(proposalPayload);
                decodedSP.proposal.payload = ccpp;
            } catch (err) {
                throw new Error(util.format('Decoding ChaincodeProposalPayload failed: %s', err));
            }

            this.transientMap = new Map();
            ccpp.getTransientmapMap().forEach((value, key) => {
                this.transientMap.set(key, Buffer.from(value));
            });

            this.signedProposal = decodedSP;

            this.binding = computeProposalBinding(decodedSP);
        }
    }

    /**
     * Returns the arguments as array of strings from the chaincode invocation request.
     * Equivalent to [getStringArgs()]{@link ChaincodeStub#getStringArgs}
     * @returns {string[]}
     */
    getArgs() {
        return this.args;
    }

    /**
     * Returns the arguments as array of strings from the chaincode invocation request
     * @returns {string[]}
     */
    getStringArgs() {
        return this.args;
    }

    getBufferArgs() {
        return this.bufferArgs;
    }

    /**
     * @typedef FunctionAndParameters
     * @property {string} fcn The function name, which by chaincode programming convention
     * is the first argument in the array of arguments
     * @property {string[]} params The rest of the arguments, as array of strings
     * @class
     * @memberof fabric-shim
     */

    /**
     * Returns an object containing the chaincode function name to invoke, and the array
     * of arguments to pass to the target function
     * @returns {FunctionAndParameters}
     */
    getFunctionAndParameters() {
        const values = this.getStringArgs();
        if (values.length >= 1) {
            return {
                fcn: values[0],
                params: values.slice(1)
            };
        } else {
            return {
                fcn: '',
                params: []
            };
        }
    }

    /**
     * Returns the transaction ID for the current chaincode invocation request. The transaction
     * ID uniquely identifies the transaction within the scope of the channel.
     */
    getTxID() {
        return this.txId;
    }

    /**
     * Returns the channel ID for the proposal for chaincode to process.
     * This would be the 'channel_id' of the transaction proposal (see ChannelHeader
     * in protos/common/common.proto) except where the chaincode is calling another on
     * a different channel.
     */
    getChannelID() {
        return this.channel_id;
    }

    /**
     * This object contains the essential identity information of the chaincode invocation's submitter,
     * including its organizational affiliation (mspid) and certificate (id_bytes)
     * @typedef {Object} ProposalCreator
     * @property {string} mspid The unique ID of the Membership Service Provider instance that is associated
     * to the identity's organization and is able to perform digital signing and signature verification
     * @class
     * @memberof fabric-shim
     */

    /**
     * Returns the identity object of the chaincode invocation's submitter
     * @returns {ProposalCreator}
     */
    getCreator() {
        return this.creator;
    }

    /**
     * Returns the MSPID of the peer that started this chaincode
     * @returns {string} MSPID
     */
    getMspID() {
        if ('CORE_PEER_LOCALMSPID' in process.env) {
            return process.env.CORE_PEER_LOCALMSPID;
        } else {
            throw new Error('CORE_PEER_LOCALMSPID is unset in chaincode process');
        }
    }

    /**
     * Returns the transient map that can be used by the chaincode but not
     * saved in the ledger, such as cryptographic information for encryption and decryption
     * @returns {Map<string:Buffer>}
     */
    getTransient() {
        return this.transientMap;
    }

    /**
     * The SignedProposal object represents the request object sent by the client application
     * to the chaincode.
     * @typedef {Object} SignedProposal
     * @property {Buffer} signature The signature over the proposal. This signature is to be verified against
     * the {@link ProposalCreator} returned by <code>getCreator()</code>. The signature will have already been
     * verified by the peer before the invocation request reaches the chaincode.
     * @property {Proposal} proposal The object containing the chaincode invocation request and metadata about the request
     * @memberof fabric-shim
     * @class
     */

    /**
     * The essential content of the chaincode invocation request
     * @typedef {Object} Proposal
     * @property {Header} header The header object contains metadata describing key aspects of the invocation
     * request such as target channel, transaction ID, and submitter identity etc.
     * @property {ChaincodeProposalPayload} payload The payload object contains actual content of the invocation request
     * @memberof fabric-shim
     * @class
     */

    /**
     * @typedef {Object} Header
     * @property {ChannelHeader} channel_header Channel header identifies the destination channel of the invocation
     * request and the type of request etc.
     * @property {SignatureHeader} signature_header Signature header has replay prevention and message authentication features
     * @memberof fabric-shim
     * @class
     */

    /**
     * Channel header identifies the destination channel of the invocation
     * request and the type of request etc.
     * @typedef {Object} ChannelHeader
     * @property {number} type Any of the following:
     * <ul>
     * <li>MESSAGE = 0;                   // Used for messages which are signed but opaque
     * <li>CONFIG = 1;                    // Used for messages which express the channel config
     * <li>CONFIG_UPDATE = 2;             // Used for transactions which update the channel config
     * <li>ENDORSER_TRANSACTION = 3;      // Used by the SDK to submit endorser based transactions
     * <li>ORDERER_TRANSACTION = 4;       // Used internally by the orderer for management
     * <li>DELIVER_SEEK_INFO = 5;         // Used as the type for Envelope messages submitted to instruct the Deliver API to seek
     * <li>CHAINCODE_PACKAGE = 6;         // Used for packaging chaincode artifacts for install
     * </ul>
     * @property {number} version
     * @property {google.protobuf.Timestamp} timestamp The local time when the message was created by the submitter
     * @property {string} channel_id Identifier of the channel that this message bound for
     * @property {string} tx_id Unique identifier used to track the transaction throughout the proposal endorsement, ordering,
     * validation and committing to the ledger
     * @property {number} epoch
     * @memberof fabric-shim
     * @class
     */

    /**
     * @typedef {Object} SignatureHeader
     * @property {ProposalCreator} creator The submitter of the chaincode invocation request
     * @property {Buffer} nonce Arbitrary number that may only be used once. Can be used to detect replay attacks.
     * @memberof fabric-shim
     * @class
     */

    /**
     * @typedef {Object} ChaincodeProposalPayload
     * @property {Buffer} input Input contains the arguments for this invocation. If this invocation
     * deploys a new chaincode, ESCC/VSCC are part of this field. This is usually a marshaled ChaincodeInvocationSpec
     * @property {Map<string:Buffer>} transientMap TransientMap contains data (e.g. cryptographic material) that might be used
     * to implement some form of application-level confidentiality. The contents of this field are supposed to always
     * be omitted from the transaction and excluded from the ledger.
     * @memberof fabric-shim
     * @class
     */

    /**
     * Returns a fully decoded object of the signed transaction proposal
     * @returns {SignedProposal}
     */
    getSignedProposal() {
        return this.signedProposal;
    }

    /**
     * Returns the timestamp when the transaction was created. This
     * is taken from the transaction {@link ChannelHeader}, therefore it will indicate the
     * client's timestamp, and will have the same value across all endorsers.
     * Object returned: { seconds: [Long] { low: [int32], high: [int32], unsigned: [bool] }, nanos: [int32] }
     */
    getTxTimestamp() {
        return {
            nanos: this.txTimestamp.getNanos(),
            seconds: Long.fromNumber(this.txTimestamp.getSeconds(), true),
        };
    }

    /**
     * Returns the Date object of when the transaction was created. This
     * is taken from the transaction {@link ChannelHeader}, therefore it will indicate the
     * client's date, and will have the same value across all endorsers.
     */
    getDateTimestamp() {
        return this.txTimestamp.toDate();
    }

    /**
     * Returns a HEX-encoded string of SHA256 hash of the transaction's nonce, creator and epoch concatenated, as a
     * unique representation of the specific transaction. This value can be used to prevent replay attacks in chaincodes
     * that need to authenticate an identity independent of the transaction's submitter. In a chaincode proposal, the
     * submitter will have been authenticated by the peer such that the identity returned by
     * [stub.getCreator()]{@link ChaincodeStub#getCreator} can be trusted. But in some scenarios, the chaincode needs
     * to authenticate an identity independent of the proposal submitter.<br><br>
     *
     * For example, Alice is the administrator who installs and instantiates a chaincode that manages assets. During
     * instantiate Alice assigns the initial owner of the asset to Bob. The chaincode has a function called <code>
     * transfer()</code> that moves the asset to another identity by changing the asset's "owner" property to the
     * identity receiving the asset. Naturally only Bob, the current owner, is supposed to be able to call that function.
     * While the chaincode can rely on stub.getCreator() to check the submitter's identity and compare that with the
     * current owner, sometimes it's not always possible for the asset owner itself to submit the transaction. Let's suppose
     * Bob hires a broker agency to handle his trades. The agency participates in the blockchain network and carry out trades
     * on behalf of Bob. The chaincode must have a way to authenticate the transaction to ensure it has Bob's authorization
     * to do the asset transfer. This can be achieved by asking Bob to sign the message, so that the chaincode can use
     * Bob's certificate, which was obtained during the chaincode instantiate, to verify the signature and thus ensure
     * the trade was authorized by Bob.<br><br>
     *
     * Now, to prevent Bob's signature from being re-used in a malicious attack, we want to ensure the signature is unique.
     * This is where the <code>binding</code> concept comes in. As explained above, the binding string uniquely represents
     * the transaction where the trade proposal and Bob's authorization is submitted in. As long as Bob's signature is over
     * the proposal payload and the binding string concatenated together, namely <code>sigma=Sign(BobSigningKey, tx.Payload||tx.Binding)</code>,
     * it's guaranteed to be unique and can not be re-used in a different transaction for exploitation.<br><br>
     *
     * @returns {string} A HEX-encoded string of SHA256 hash of the transaction's nonce, creator and epoch concatenated
     */
    getBinding() {
        return this.binding;
    }

    /**
     * Retrieves the current value of the state variable <code>key</code>
     * @async
     * @param {string} key State variable key to retrieve from the state store
     * @returns {Promise<byte[]>} Promise for the current value of the state variable
     */
    async getState(key) {
        logger.debug('getState called with key:%s', key);
        // Access public data by setting the collection to empty string
        const collection = '';
        return await this.handler.handleGetState(collection, key, this.channel_id, this.txId);
    }

    /**
     * Writes the state variable <code>key</code> of value <code>value</code>
     * to the state store. If the variable already exists, the value will be
     * overwritten.
     * @async
     * @param {string} key State variable key to set the value for
     * @param {byte[]|string} value State variable value
     * @returns {Promise} Promise will be resolved when the peer has successfully handled the state update request
     * or rejected if any errors
     */
    async putState(key, value) {
        // Access public data by setting the collection to empty string
        const collection = '';
        if (typeof value === 'string') {
            value = Buffer.from(value);
        }
        return await this.handler.handlePutState(collection, key, value, this.channel_id, this.txId);
    }

    /**
     * Deletes the state variable <code>key</code> from the state store.
     * @async
     * @param {string} key State variable key to delete from the state store
     * @returns {Promise} Promise will be resolved when the peer has successfully handled the state delete request
     * or rejected if any errors
     */
    async deleteState(key) {
        // Access public data by setting the collection to empty string
        const collection = '';
        return await this.handler.handleDeleteState(collection, key, this.channel_id, this.txId);
    }

    /**
     * Sets the key-level endorsement policy for `key`
     *
     * @async
     * @param {string} key State variable key to set endorsement policy
     * @param {Buffer} ep endorsement policy
     */
    async setStateValidationParameter(key, ep) {
        // Access public data by setting the collection to empty string
        const collection = '';
        return this.handler.handlePutStateMetadata(collection, key, this.validationParameterMetakey, ep, this.channel_id, this.txId);
    }

    /**
     * getStateValidationParameter retrieves the key-level endorsement policy
     * for `key`. Note that this will introduce a read dependency on `key` in
     * the transaction's readset.
     *
     * @async
     * @param {string} key State variable key to set endorsement policy
     * @returns {Buffer} returns the endorsement policy for this key
     */
    async getStateValidationParameter(key) {
        // Access public data by setting the collection to empty string
        const collection = '';
        const res = await this.handler.handleGetStateMetadata(collection, key, this.channel_id, this.txId);
        return res[this.validationParameterMetakey];
    }

    /**
     * Returns a range iterator over a set of keys in the
     * ledger. The iterator can be used to iterate over all keys
     * between the startKey (inclusive) and endKey (exclusive).
     *
     * However, if the number of keys between startKey and endKey is greater than the
     * totalQueryLimit (defined in core.yaml, which is the peer's configuration file),
     * this iterator cannot be used to fetch all keys (results will be limited by the totalQueryLimit).
     *
     * The keys are returned by the iterator in lexical order. Note
     * that startKey and endKey can be empty string, which implies unbounded range
     * query on start or end.<br><br>
     * Call close() on the returned {@link StateQueryIterator} object when done.
     * The query is re-executed during validation phase to ensure result set
     * has not changed since transaction endorsement (phantom reads detected).
     * @async
     * @param {string} startKey State variable key as the start of the key range (inclusive)
     * @param {string} endKey State variable key as the end of the key range (exclusive)
     * @returns {Promise} Promise for a {@link StateQueryIterator} object
     */
    getStateByRange(startKey, endKey) {  // due to async iterator, cannot be declared async
        if (!startKey) {
            startKey = EMPTY_KEY_SUBSTITUTE;
        }
        try {
            validateSimpleKeys(startKey, endKey);
        } catch (err) {
            return Promise.reject(err);
        }
        // Access public data by setting the collection to empty string
        const collection = '';
        // Need to ensure that the resolved promise returns an iterator and not an object containing an iterator property.
        const promise = this.handler.handleGetStateByRange(collection, startKey, endKey, this.channel_id, this.txId)
            .then((result) => result.iterator);
        return convertToAsyncIterator(promise);
    }

    /**
     * @typedef {Object} QueryResponseMetadata
     * @property {number} fetched_records_count number of records fetched
     * @property {string} bookmark the current bookmark to be used on the next pagination query
     * @memberof fabric-shim
     * @class
     */

    /**
     * @typedef {Object} PaginationQueryResponse
     * @property {StateQueryIterator} iterator the iterator which provices access to the returned data
     * @property {QueryResponseMetadata} metadata the pagination metadata
     * @memberof fabric-shim
     * @class
     */

    /**
     * getStateByRangeWithPagination returns a range iterator over a set of keys in the
     * ledger. The iterator can be used to fetch keys between the startKey (inclusive)
     * and endKey (exclusive).
     * When an empty string is passed as a value to the bookmark argument, the returned
     * iterator can be used to fetch the first `pageSize` keys between the startKey
     * (inclusive) and endKey (exclusive).
     * When the bookmark is a non-emptry string, the iterator can be used to fetch
     * the first `pageSize` keys between the bookmark (inclusive) and endKey (exclusive).
     * Note that only the bookmark present in a prior page of query results (ResponseMetadata)
     * can be used as a value to the bookmark argument. Otherwise, an empty string must
     * be passed as bookmark.
     * The keys are returned by the iterator in lexical order. Note
     * that startKey and endKey can be empty string, which implies unbounded range
     * query on start or end.
     * Call Close() on the returned StateQueryIteratorInterface object when done.
     * This call is only supported in a read only transaction.
     *
     * @param {string} startKey
     * @param {string} endKey
     * @param {int} pageSize
     * @param {string} bookmark
     * @returns {Promise} Promise for a {@link PaginationQueryResponse} object
     */
    getStateByRangeWithPagination(startKey, endKey, pageSize, bookmark) {  // due to async iterator, cannot be declared async
        if (!startKey) {
            startKey = EMPTY_KEY_SUBSTITUTE;
        }
        if (!bookmark) {
            bookmark = '';
        }
        try {
            validateSimpleKeys(startKey, endKey);
        } catch (err) {
            return Promise.reject(err);
        }
        const collection = '';
        const metadata = createQueryMetadata(pageSize, bookmark);
        const promise = this.handler.handleGetStateByRange(collection, startKey, endKey, this.channel_id, this.txId, metadata);
        return convertToAsyncIterator(promise);
    }

    /**
     * Performs a "rich" query against a state database. It is
     * only supported for state databases that support rich query,
     * e.g. CouchDB. The query string is in the native syntax
     * of the underlying state database. An {@link StateQueryIterator} is returned
     * which can be used to iterate over all keys in the query result set.<br><br>
     *
     * However, if the number of keys in the query result set is greater than the
     * totalQueryLimit (defined in core.yaml), this iterator cannot be used
     * to fetch all keys in the query result set (results will be limited by
     * the totalQueryLimit).
     *
     * The query is NOT re-executed during validation phase, phantom reads are
     * not detected. That is, other committed transactions may have added,
     * updated, or removed keys that impact the result set, and this would not
     * be detected at validation/commit time. Applications susceptible to this
     * should therefore not use GetQueryResult as part of transactions that update
     * ledger, and should limit use to read-only chaincode operations.
     * @async
     * @param {string} query Query string native to the underlying state database
     * @returns {Promise} Promise for a {@link StateQueryIterator} object
     */
    getQueryResult(query) { // due to async iterator, cannot be declared async
        // Access public data by setting the collection to empty string
        const collection = '';
        // Need to ensure that the resolved promise returns an iterator and not an object containing an iterator property.
        const promise = this.handler.handleGetQueryResult(collection, query, null, this.channel_id, this.txId)
            .then((result) => result.iterator);
        return convertToAsyncIterator(promise);
    }

    /**
     * getQueryResultWithPagination performs a "rich" query against a state database.
     * It is only supported for state databases that support rich query,
     * e.g., CouchDB. The query string is in the native syntax
     * of the underlying state database. An iterator is returned
     * which can be used to iterate over keys in the query result set.
     * When an empty string is passed as a value to the bookmark argument, the returned
     * iterator can be used to fetch the first `pageSize` of query results.
     * When the bookmark is a non-emptry string, the iterator can be used to fetch
     * the first `pageSize` keys between the bookmark and the last key in the query result.
     * Note that only the bookmark present in a prior page of query results (ResponseMetadata)
     * can be used as a value to the bookmark argument. Otherwise, an empty string
     * must be passed as bookmark.
     * This call is only supported in a read only transaction.
     *
     * @param {string} query
     * @param {int} pageSize
     * @param {string} bookmark
     * @returns {Promise} Promise for a {@link PaginationQueryResponse} object
     */
    getQueryResultWithPagination(query, pageSize, bookmark) { // due to async iterator, cannot be declared async
        if (!bookmark) {
            bookmark = '';
        }
        const metadata = createQueryMetadata(pageSize, bookmark);
        const collection = '';
        const promise = this.handler.handleGetQueryResult(collection, query, metadata, this.channel_id, this.txId);
        return convertToAsyncIterator(promise);
    }

    /**
     * Returns a history of key values across time.
     * For each historic key update, the historic value and associated
     * transaction id and timestamp are returned. The timestamp is the
     * timestamp provided by the client in the proposal header.
     * This method requires peer configuration
     * <code>core.ledger.history.enableHistoryDatabase</code> to be true.<br><br>
     * The query is NOT re-executed during validation phase, phantom reads are
     * not detected. That is, other committed transactions may have updated
     * the key concurrently, impacting the result set, and this would not be
     * detected at validation/commit time. Applications susceptible to this
     * should therefore not use GetHistoryForKey as part of transactions that
     * update ledger, and should limit use to read-only chaincode operations.
     * @async
     * @param {string} key The state variable key
     * @returns {Promise} Promise for a {@link HistoryQueryIterator} object
     */
    getHistoryForKey(key) { // due to async iterator, cannot be declared async
        const promise = this.handler.handleGetHistoryForKey(key, this.channel_id, this.txId);
        return convertToAsyncIterator(promise);
    }

    /**
     * A Response object is returned from a chaincode invocation
     * @typedef {Object} Response
     * @property {number} status A status code that follows the HTTP status codes
     * @property {string} message A message associated with the response code
     * @property {byte[]} payload A payload that can be used to include metadata with this response
     * @class
     * @memberof fabric-shim
     */

    /**
     * Locally calls the specified chaincode <code>invoke()</code> using the
     * same transaction context; that is, chaincode calling chaincode doesn't
     * create a new transaction message.<br><br>
     * If the called chaincode is on the same channel, it simply adds the called
     * chaincode read set and write set to the calling transaction.<br><br>
     * If the called chaincode is on a different channel,
     * only the Response is returned to the calling chaincode; any PutState calls
     * from the called chaincode will not have any effect on the ledger; that is,
     * the called chaincode on a different channel will not have its read set
     * and write set applied to the transaction. Only the calling chaincode's
     * read set and write set will be applied to the transaction. Effectively
     * the called chaincode on a different channel is a `Query`, which does not
     * participate in state validation checks in subsequent commit phase.<br><br>
     * If `channel` is empty, the caller's channel is assumed.
     * @async
     * @param {string} chaincodeName Name of the chaincode to call
     * @param {string[]} args List of arguments to pass to the called chaincode
     * @param {string} channel Name of the channel where the target chaincode is active
     * @returns {Promise} Promise for a {@link Response} object returned by the called chaincode
     */
    async invokeChaincode(chaincodeName, args, channel) {
        if (channel && channel.length > 0) {
            chaincodeName = chaincodeName + '/' + channel;
        }
        return await this.handler.handleInvokeChaincode(chaincodeName, args, this.channel_id, this.txId);
    }

    /**
     * Allows the chaincode to propose an event on the transaction proposal response.
     * When the transaction is included in a block and the block is successfully committed to the ledger,
     * the block event (including transaction level chaincode events)
     * will be delivered to the current client application event listeners that have been registered with the peer's event producer.
     * Consult each SDK's documentation for details.
     * Only a single chaincode event can be included in a transaction.
     * If setEvent() is called multiple times only the last event will be included in the transaction.
     * The event must originate from the outer-most invoked chaincode in chaincode-to-chaincode scenarios.
     * The marshaled ChaincodeEvent will be available in the transaction's ChaincodeAction.events field.
     * @param {string} name Name of the event
     * @param {byte[]} payload A payload can be used to include data about the event
     */
    setEvent(name, payload) {
        if (typeof name !== 'string' || name === '') {
            throw new Error('Event name must be a non-empty string');
        }

        // Because this is passed directly into gRPC as an object, rather
        // than a serialized protocol buffer message, it uses snake_case
        // rather than camelCase like the rest of the code base.
        this.chaincodeEvent = new ChaincodeEvent();
        this.chaincodeEvent.setPayload(payload);
        this.chaincodeEvent.setEventName(name);
    }

    /**
     * Creates a composite key by combining the objectType string and the given `attributes` to form a composite
     * key. The objectType and attributes are expected to have only valid utf8 strings and should not contain
     * U+0000 (nil byte) and U+10FFFF (biggest and unallocated code point). The resulting composite key can be
     * used as the key in [putState()]{@link ChaincodeStub#putState}.<br><br>
     *
     * Hyperledger Fabric uses a simple key/value model for saving chaincode states. In some use case scenarios,
     * it is necessary to keep track of multiple attributes. Furthermore, it may be necessary to make the various
     * attributes searchable. Composite keys can be used to address these requirements. Similar to using composite
     * keys in a relational database table, here you would treat the searchable attributes as key columns that
     * make up the composite key. Values for the attributes become part of the key, thus they are searchable with
     * functions like [getStateByRange()]{@link ChaincodeStub#getStateByRange} and
     * [getStateByPartialCompositeKey()]{@link ChaincodeStub#getStateByPartialCompositeKey}.<br><br>
     *
     * @param {string} objectType A string used as the prefix of the resulting key
     * @param {string[]} attributes List of attribute values to concatenate into the key
     * @return {string} A composite key with the <code>objectType</code> and the array of <code>attributes</code>
     * joined together with special delimiters that will not be confused with values of the attributes
     */
    createCompositeKey(objectType, attributes) {
        validateCompositeKeyAttribute(objectType);
        if (!Array.isArray(attributes)) {
            throw new Error('attributes must be an array');
        }

        let compositeKey = COMPOSITEKEY_NS + objectType + MIN_UNICODE_RUNE_VALUE;
        attributes.forEach((attribute) => {
            validateCompositeKeyAttribute(attribute);
            compositeKey = compositeKey + attribute + MIN_UNICODE_RUNE_VALUE;
        });
        return compositeKey;
    }

    /**
     * Splits the specified key into attributes on which the composite key was formed.
     * Composite keys found during range queries or partial composite key queries can
     * therefore be split into their original composite parts, essentially recovering
     * the values of the attributes.
     * @param {string} compositeKey The composite key to split
     * @return {Object} An object which has properties of 'objectType' (string) and
     * 'attributes' (string[])
     */
    splitCompositeKey(compositeKey) {
        const result = {objectType: null, attributes: []};
        if (compositeKey && compositeKey.length > 1 && compositeKey.charAt(0) === COMPOSITEKEY_NS) {
            const splitKey = compositeKey.substring(1).split(MIN_UNICODE_RUNE_VALUE);
            result.objectType = splitKey[0];
            splitKey.pop();
            if (splitKey.length > 1) {
                splitKey.shift();
                result.attributes = splitKey;
            }
        }
        return result;
    }

    /**
     * Queries the state in the ledger based on a given partial composite key. This function returns an iterator
     * which can be used to iterate over all composite keys whose prefix matches the given partial composite key.
     *
     * However, if the number of matching composite keys is greater than the totalQueryLimit (defined in core.yaml),
     * this iterator cannot be used to fetch all matching keys (results will be limited by the totalQueryLimit).
     *
     * The `objectType` and attributes are expected to have only valid utf8 strings and should not contain
     * U+0000 (nil byte) and U+10FFFF (biggest and unallocated code point).<br><br>
     *
     * See related functions [splitCompositeKey]{@link ChaincodeStub#splitCompositeKey} and
     * [createCompositeKey]{@link ChaincodeStub#createCompositeKey}.<br><br>
     *
     * Call close() on the returned {@link StateQueryIterator} object when done.<br><br>
     *
     * The query is re-executed during validation phase to ensure result set has not changed since transaction
     * endorsement (phantom reads detected).
     *
     * This function should be used only for a partial composite key.
     * For a full composite key, an iter with empty response would be returned.
     *
     * @async
     * @param {string} objectType A string used as the prefix of the resulting key
     * @param {string[]} attributes List of attribute values to concatenate into the partial composite key
     * @return {Promise} A promise that resolves with a {@link StateQueryIterator}, rejects if an error occurs
     */
    getStateByPartialCompositeKey(objectType, attributes) { // due to async iterator, cannot be declared async
        const partialCompositeKey = this.createCompositeKey(objectType, attributes);
        const startKey = partialCompositeKey;
        const endKey = partialCompositeKey + MAX_UNICODE_RUNE_VALUE;
        const collection = '';
        // Need to ensure that the resolved promise returns an iterator and not an object containing an iterator property.
        const promise = this.handler.handleGetStateByRange(collection, startKey, endKey, this.channel_id, this.txId)
            .then((result) => result.iterator);
        return convertToAsyncIterator(promise);
    }

    /**
     * GetStateByPartialCompositeKeyWithPagination queries the state in the ledger based on
     * a given partial composite key. This function returns an iterator
     * which can be used to iterate over the composite keys whose
     * prefix matches the given partial composite key.
     * When an empty string is passed as a value to the bookmark argument, the returned
     * iterator can be used to fetch the first `pageSize` composite keys whose prefix
     * matches the given partial composite key.
     * When the bookmark is a non-emptry string, the iterator can be used to fetch
     * the first `pageSize` keys between the bookmark (inclusive) and the last matching
     * composite key.
     * Note that only the bookmark present in a prior page of query result (ResponseMetadata)
     * can be used as a value to the bookmark argument. Otherwise, an empty string must
     * be passed as bookmark.
     * The `objectType` and attributes are expected to have only valid utf8 strings
     * and should not contain U+0000 (nil byte) and U+10FFFF (biggest and unallocated
     * code point). See related functions SplitCompositeKey and CreateCompositeKey.
     * Call Close() on the returned StateQueryIteratorInterface object when done.
     * This call is only supported in a read only transaction.
     * This function should be used only for a partial composite key.
     * For a full composite key, an iter with empty response would be returned.
     *
     * @param {string} objectType
     * @param {string[]} attributes
     * @param {int} pageSize
     * @param {string} bookmark
     * @returns {Promise} Promise for a {@link PaginationQueryResponse} object
     */
    getStateByPartialCompositeKeyWithPagination(objectType, attributes, pageSize, bookmark) { // due to async iterator, cannot be declared async
        if (!bookmark) {
            bookmark = '';
        }
        const partialCompositeKey = this.createCompositeKey(objectType, attributes);
        const startKey = partialCompositeKey;
        const endKey = partialCompositeKey + MAX_UNICODE_RUNE_VALUE;
        const collection = '';
        const metadata = createQueryMetadata(pageSize, bookmark);
        const promise = this.handler.handleGetStateByRange(collection, startKey, endKey, this.channel_id, this.txId, metadata);
        return convertToAsyncIterator(promise);
    }

    /**
     * getPrivateData returns the value of the specified `key` from the specified
     * `collection`. Note that GetPrivateData doesn't read data from the
     * private writeset, which has not been committed to the `collection`. In
     * other words, GetPrivateData doesn't consider data modified by PutPrivateData
     * that has not been committed.
     *
     * @param {string} collection The collection name
     * @param {string} key Private data variable key to retrieve from the state store
     * @returns {Promise<byte[]>} Promise for the private value from the state store
     */
    async getPrivateData(collection, key) {
        logger.debug('getPrivateData called with collection:%s, key:%s', collection, key);
        if (!collection || typeof collection !== 'string') {
            throw new Error('collection must be a valid string');
        }
        if (!key || typeof key !== 'string') {
            throw new Error('key must be a valid string');
        }

        return await this.handler.handleGetState(collection, key, this.channel_id, this.txId);
    }

    /**
     * getPrivateDataHash returns the hash of the value of the specified `key` from
     * the specified `collection`.
     *
     * @param {string} collection The collection name
     * @param {string} key Private data variable key to retrieve a hash from the state store
     * @returns {Promise<byte[]>} Promise for the private value hash from the state store
     */
    async getPrivateDataHash(collection, key) {
        logger.debug('getPrivateDataHash called with collection:%s, key:%s', collection, key);
        if (!collection || typeof collection !== 'string') {
            throw new Error('collection must be a valid string');
        }
        if (!key || typeof key !== 'string') {
            throw new Error('key must be a valid string');
        }

        return await this.handler.handleGetPrivateDataHash(collection, key, this.channel_id, this.txId);
    }

    /**
     * putPrivateData puts the specified `key` and `value` into the transaction's
     * private writeSet. Note that only hash of the private writeSet goes into the
     * transaction proposal response (which is sent to the client who issued the
     * transaction) and the actual private writeSet gets temporarily stored in a
     * transient store. PutPrivateData doesn't effect the `collection` until the
     * transaction is validated and successfully committed. Simple keys must not be
     * an empty string and must not start with null character (0x00), in order to
     * avoid range query collisions with composite keys, which internally get
     * prefixed with 0x00 as composite key namespace.
     *
     * @param {string} collection The collection name
     * @param {string} key Private data variable key to set the value for
     * @param {string|byte[]} value Private data variable value
     */
    async putPrivateData(collection, key, value) {
        logger.debug('putPrivateData called with collection:%s, key:%s', collection, key);
        if (!collection || typeof collection !== 'string') {
            throw new Error('collection must be a valid string');
        }
        if (!key || typeof key !== 'string') {
            throw new Error('key must be a valid string');
        }
        if (!value) {
            throw new Error('value must be valid');
        }
        if (typeof value === 'string') {
            value = Buffer.from(value);
        }

        return this.handler.handlePutState(collection, key, value, this.channel_id, this.txId);
    }

    /**
     * deletePrivateData records the specified `key` to be deleted in the private writeset of
     * the transaction. Note that only hash of the private writeset goes into the
     * transaction proposal response (which is sent to the client who issued the
     * transaction) and the actual private writeset gets temporarily stored in a
     * transient store. The `key` and its value will be deleted from the collection
     * when the transaction is validated and successfully committed.
     *
     * @param {string} collection The collection name
     * @param {string} key Private data variable key to delete from the state store
     */
    async deletePrivateData(collection, key) {
        logger.debug('deletePrivateData called with collection:%s, key:%s', collection, key);
        if (!collection || typeof collection !== 'string') {
            throw new Error('collection must be a valid string');
        }
        if (!key || typeof key !== 'string') {
            throw new Error('key must be a valid string');
        }
        return this.handler.handleDeleteState(collection, key, this.channel_id, this.txId);
    }

    /**
     * PurgePrivateData records the specified `key` to be purged in the private writeset
     * of the transaction. Note that only hash of the private writeset goes into the
     * transaction proposal response (which is sent to the client who issued the
     * transaction) and the actual private writeset gets temporarily stored in a
     * transient store. The `key` and its value will be deleted from the collection
     * when the transaction is validated and successfully committed, and will
     * subsequently be completely removed from the private data store (that maintains
     * the historical versions of private writesets) as a background operation.
     * @param {string} collection The collection name
     * @param {string} key Private data variable key to delete from the state store
     */
    async purgePrivateData(collection, key) {
        // Access public data by setting the collection to empty string
        logger.debug('purgePrivateData called with collection:%s, key:%s', collection, key);
        if (!collection || typeof collection !== 'string') {
            throw new Error('collection must be a valid string');
        }
        if (!key || typeof key !== 'string') {
            throw new Error('key must be a valid string');
        }
        return await this.handler.handlePurgeState(collection, key, this.channel_id, this.txId);
    }

    /**
     * SetPrivateDataValidationParameter sets the key-level endorsement policy
     * for the private data specified by `key`.
     *
     * @async
     * @param {string} collection The collection name for this private data
     * @param {string} key Private data variable key to set endorsement policy
     * @param {Buffer} ep endorsement policy
     */
    async setPrivateDataValidationParameter(collection, key, ep) {
        return this.handler.handlePutStateMetadata(collection, key, this.validationParameterMetakey, ep, this.channel_id, this.txId);
    }

    /**
     * GetPrivateDataValidationParameter retrieves the key-level endorsement
     * policy for the private data specified by `key`. Note that this introduces
     * a read dependency on `key` in the transaction's readset.
     *
     * @async
     * @param {string} collection The collection name for this private data
     * @param {string} key Private data variable key by which to retrieve endorsement policy
     * @returns {Buffer} endorsement policy for this key
     */
    async getPrivateDataValidationParameter(collection, key) {
        const res = await this.handler.handleGetStateMetadata(collection, key, this.channel_id, this.txId);
        return res[this.validationParameterMetakey];
    }

    /**
     * @typedef {Object} PrivateQueryResponse
     * @property {StateQueryIterator} iterator the iterator which provices access to the returned data
     * @memberof fabric-shim
     * @class
     */

    /**
     * getPrivateDataByRange returns a range iterator over a set of keys in a
     * given private collection. The iterator can be used to iterate over all keys
     * between the startKey (inclusive) and endKey (exclusive).
     * The keys are returned by the iterator in lexical order. Note
     * that startKey and endKey can be empty string, which implies unbounded range
     * query on start or end.
     * Call Close() on the returned StateQueryIteratorInterface object when done.
     * The query is re-executed during validation phase to ensure result set
     * has not changed since transaction endorsement (phantom reads detected).
     *
     * @param {string} collection The collection name
     * @param {string} startKey Private data variable key as the start of the key range (inclusive)
     * @param {string} endKey Private data variable key as the end of the key range (exclusive)
     * @returns {Promise} Promise for a {@link PrivateQueryResponse} object
     */
    getPrivateDataByRange(collection, startKey, endKey) { // due to async iterator, cannot be declared async
        logger.debug('getPrivateDataByRange called with collection:%s, startKey:%s, endKey:%s', collection, startKey, endKey);
        if (arguments.length !== 3) {
            return Promise.reject(new Error('getPrivateDataByRange requires three arguments, collection, startKey and endKey'));
        }
        if (!collection || typeof collection !== 'string') {
            return Promise.reject(new Error('collection must be a valid string'));
        }
        if (!startKey) {
            startKey = EMPTY_KEY_SUBSTITUTE;
        }

        const promise = this.handler.handleGetStateByRange(collection, startKey, endKey, this.channel_id, this.txId);
        return convertToAsyncIterator(promise);
    }

    /**
     * getPrivateDataByPartialCompositeKey queries the state in a given private
     * collection based on a given partial composite key. This function returns
     * an iterator which can be used to iterate over all composite keys whose prefix
     * matches the given partial composite key. The `objectType` and attributes are
     * expected to have only valid utf8 strings and should not contain
     * U+0000 (nil byte) and U+10FFFF (biggest and unallocated code point).
     * See related functions SplitCompositeKey and CreateCompositeKey.
     * Call Close() on the returned StateQueryIteratorInterface object when done.
     * The query is re-executed during validation phase to ensure result set
     * has not changed since transaction endorsement (phantom reads detected).
     * This function should be used only for a partial composite key.
     * For a full composite key, an iter with empty response would be returned.
     *
     * @param {string} collection The collection name
     * @param {string} objectType A string used as the prefix of the resulting key
     * @param {string[]} attributes List of attribute values to concatenate into the partial composite key
     * @returns {Promise} Promise for a {@link PrivateQueryResponse} object
     */
    getPrivateDataByPartialCompositeKey(collection, objectType, attributes) { // due to async iterator, cannot be declared async
        logger.debug('getPrivateDataByPartialCompositeKey called with collection:%s, objectType:%s, attributes:%j', collection, objectType, attributes);
        if (arguments.length !== 3) {
            return Promise.reject(new Error('getPrivateDataByPartialCompositeKey requires three arguments, collection, objectType and attributes'));
        }
        if (!collection || typeof collection !== 'string') {
            return Promise.reject(new Error('collection must be a valid string'));
        }
        const partialCompositeKey = this.createCompositeKey(objectType, attributes);

        const promise = this.getPrivateDataByRange(collection, partialCompositeKey, partialCompositeKey + MAX_UNICODE_RUNE_VALUE);
        return convertToAsyncIterator(promise);
    }

    /**
     * getPrivateDataQueryResult performs a "rich" query against a given private
     * collection. It is only supported for state databases that support rich query,
     * e.g.CouchDB. The query string is in the native syntax
     * of the underlying state database. An iterator is returned
     * which can be used to iterate (next) over the query result set.
     * The query is NOT re-executed during validation phase, phantom reads are
     * not detected. That is, other committed transactions may have added,
     * updated, or removed keys that impact the result set, and this would not
     * be detected at validation/commit time. Applications susceptible to this
     * should therefore not use GetQueryResult as part of transactions that update
     * ledger, and should limit use to read-only chaincode operations.
     *
     * @param {string} collection The collection name
     * @param {string} query The query to be performed
     * @returns {Promise} Promise for a {@link PrivateQueryResponse} object
     */
    getPrivateDataQueryResult(collection, query) { // due to async iterator, cannot be declared async
        logger.debug('getPrivateDataQueryResult called with collection:%s, query:%j', collection, query);
        if (arguments.length !== 2) {
            return Promise.reject(new Error('getPrivateDataQueryResult requires two arguments, collection and query'));
        }
        if (!collection || typeof collection !== 'string') {
            return Promise.reject(new Error('collection must be a valid string'));
        }

        const promise = this.handler.handleGetQueryResult(collection, query, null, this.channel_id, this.txId);
        return convertToAsyncIterator(promise);
    }
}

module.exports = ChaincodeStub;
module.exports.RESPONSE_CODE = RESPONSE_CODE;
