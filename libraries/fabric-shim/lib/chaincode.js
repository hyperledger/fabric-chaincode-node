/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
/* eslint-disable no-useless-escape */
'use strict';


const util = require('util');
const {Certificate} = require('@fidm/x509');
const Logger = require('./logger');

const utils = require('./utils/utils');

const logger = Logger.getLogger('lib/chaincode.js');
const {ChaincodeSupportClient} = require('./handler');
const ChaincodeServer = require('./server');
const Iterators = require('./iterators');
const ChaincodeStub = require('./stub');
const KeyEndorsementPolicy = require('./utils/statebased');
const fs = require('fs');

const {peer} = require('@hyperledger/fabric-protos');

const StartCommand = require('./cmds/startCommand.js');

const yargs = require('yargs');

/**
 * Chaincodes must implement the methods in this interface. The Init() method is called during
 * chaincode <code>instantiation</code> or <code>upgrade</code> to preform any necessary intitialization
 * of the application state. Invoke() is called by <code>invoke transaction</code> or <code>query</code>
 * requests. Both methods are provided with a [stub]{@link ChaincodeStub} object that can be used to
 * discover information on the request (invoking identity, target channel, arguments, etc.) as well as
 * talking with the peer to retrieve or update application state.
 * @class
 * @memberof fabric-shim
 */
class ChaincodeInterface {

    /**
	 * Called during chaincode instantiate and upgrade. This method can be used
	 * to initialize asset states
	 * @async
	 * @param {ChaincodeStub} stub The chaincode stub is implemented by the <code>fabric-shim</code>
	 * library and passed to the ChaincodeInterface calls by the Hyperledger Fabric platform. The stub
	 * encapsulates the APIs between the chaincode implementation and the Fabric peer
	 */
    async Init(stub) {}

    /**
	 * called throughout the life time of the chaincode to carry out business
	 * transaction logic and effect the asset states
	 * @async
	 * @param {ChaincodeStub} stub The chaincode stub is implemented by the <code>fabric-shim</code>
	 * library and passed to the ChaincodeInterface calls by the Hyperledger Fabric platform. The stub
	 * encapsulates the APIs between the chaincode implementation and the Fabric peer
	 */
    async Invoke(stub) {}
}

/**
 * The shim class provides the service to register the chaincode with the target peer, and
 * listen for incoming requests from the peer to dispatch to the chaincode in order to process
 * transaction proposals or execute queries.
 * @class
 * @memberof fabric-shim
 */
class Shim {
    /**
	 * Call this method to start the chaincode process. After constructing a chaincode object,
	 * pass the object to this function which will initiate a request to register the chaincode
	 * with the target peer. The address of the target peer must be provided via a program
	 * argument <code>--peer.address</code>
	 * @static
	 * @param {ChaincodeInterface} chaincode User-provided object that must implement the <code>ChaincodeInterface</code>
	 */
    static start(chaincode) {
        const opts = StartCommand.getArgs(yargs);

        if (typeof chaincode !== 'object' || chaincode === null) {
            throw new Error('Missing required argument: chaincode');
        }

        if (typeof chaincode.Init !== 'function') {
            throw new Error('The "chaincode" argument must implement the "Init()" method');
        }

        if (typeof chaincode.Invoke !== 'function') {
            throw new Error('The "chaincode" argument must implement the "Invoke()" method');
        }

        logger.debug('Starting chaincode using options', opts);

        const optsCpy  = Object.assign({}, opts);
        const expectedOpts = StartCommand.validOptions;

        for (const key in optsCpy) {
            if (!Object.prototype.hasOwnProperty.call(expectedOpts, key)) {
            // if (!expectedOpts.hasOwnProperty(key)) {
                delete optsCpy[key];
            }
        }
        delete optsCpy['chaincode-id-name'];
        delete optsCpy['module-path'];

        const url = parsePeerUrl(opts['peer.address']);

        if (isTLS()) {
            logger.debug('TLS enabled');
            optsCpy.pem = fs.readFileSync(process.env.CORE_PEER_TLS_ROOTCERT_FILE).toString();

            // the peer enforces mutual TLS, so we must have the client key and cert to proceed
            const keyPath = process.env.CORE_TLS_CLIENT_KEY_PATH;
            const certPath = process.env.CORE_TLS_CLIENT_CERT_PATH;
            if (typeof keyPath !== 'string' || typeof certPath !== 'string') {
                throw new Error(
                    'The client key and cert are needed when TLS is enabled, but environment ' +
                     'variables specifying the paths to these files are missing'
                );
            }

            optsCpy.key = fs.readFileSync(keyPath).toString();
            optsCpy.cert = fs.readFileSync(certPath).toString();
        }

        const chaincodeName = opts['chaincode-id-name'];
        const client = new ChaincodeSupportClient(chaincode, url, optsCpy);

        logger.info(util.format('Registering with peer %s as chaincode "%s"', opts['peer.address'], chaincodeName));

        const chaincodePB = new peer.ChaincodeID();
        chaincodePB.setName(chaincodeName);

        client.chat({
            type: peer.ChaincodeMessage.Type.REGISTER,
            payload: chaincodePB.serializeBinary()
        });

        // return the client object to give the calling code
        // a handle to terminate pro-actively by calling client.close()
        return client;
    }

    /**
	 * @typedef {Object} SuccessResponse
	 * @property {number} status Value is always set to 200 to indicate success
	 * @property {Buffer} payload Optional custom content returned by the chaincode
	 * @class
	 * @memberof fabric-shim
	 */

    /**
	 * Returns a standard response object with status code 200 and an optional payload
	 * @static
	 * @param {Buffer} payload Can be any content the chaincode wish to return to the client
	 * @returns {SuccessResponse}
	 */
    static success(payload) {
        return {
            status: ChaincodeStub.RESPONSE_CODE.OK,
            payload: payload ? payload : Buffer.from('')
        };
    }

    /**
	 * @typedef {Object} ErrorResponse
	 * @property {number} status Value is always set to 500 to indicate error
	 * @property {string} message Optional error message returned by the chaincode
	 * @class
	 * @memberof fabric-shim
	 */

    /**
	 * Returns a standard response object with status code 200 and an optional payload
	 * @static
	 * @param {string} msg A message describing the error
	 * @returns {ErrorResponse}
	 */
    static error(msg) {
        return {
            status: ChaincodeStub.RESPONSE_CODE.ERROR,
            message: msg
        };
    }

    /**
	 * Returns a winston logger named after <code>name</code>
	 * @static
	 * @param {string} name Logger name used to label log messages produced by the returned logger
	 * @returns {Object} winston based logger. See [winston]{@link https://github.com/winstonjs/winston} documentation for usage details
	 */
    static newLogger(name) {
        if (!name) {
            name = 'shim';
        }

        return Logger.getLogger(name);
    }

    /**
     * @interface ChaincodeServerTLSProperties
     * @property {Buffer} key Private key for TLS
     * @property {Buffer} cert Certificate for TLS
     * @property {Buffer} [clientCACerts] CA certificate for client certificates if mutual TLS is used.
     */
    /**
     * @interface ChaincodeServerOpts
     * @property {string} ccid Chaincode ID
     * @property {string} address Listen address for the server
     * @property {ChaincodeServerTLSProperties} [tlsProps] TLS properties if TLS is required.
     */
    /**
     * Returns a new Chaincode server. Should be called when the chaincode is launched in a server mode.
     * @static
     * @param {ChaincodeInterface} chaincode User-provided object that must implement <code>ChaincodeInterface</code>
     * @param {ChaincodeServerOpts} serverOpts Chaincode server options
     */
    static server(chaincode, serverOpts) {
        return new ChaincodeServer(chaincode, serverOpts);
    }
}

// special OID used by Fabric to save attributes in X.509 certificates
const FABRIC_CERT_ATTR_OID = '1.2.3.4.5.6.7.8.1';

/**
 * ClientIdentity represents information about the identity that submitted the
 * transaction. Chaincodes can use this class to obtain information about the submitting
 * identity including a unique ID, the MSP (Membership Service Provider) ID, and attributes.
 * Such information is useful in enforcing access control by the chaincode.
 *
 * @example
 * <caption>Check if the submitter is an auditor</caption>
 * const ClientIdentity = require('fabric-shim').ClientIdentity;
 *
 * let cid = new ClientIdentity(stub); // "stub" is the ChaincodeStub object passed to Init() and Invoke() methods
 * if (cid.assertAttributeValue('hf.role', 'auditor')) {
 *    // proceed to carry out auditing
 * }
 *
 * @class
 * @memberof fabric-shim
 */
class ClientIdentity {
    /**
	 * Returns a new instance of ClientIdentity
	 * @param {ChaincodeStub} This is the stub object passed to Init() and Invoke() methods
	 */
    constructor(stub) {
        const loggerPrefix = utils.generateLoggingPrefix(stub.getChannelID(), stub.getTxID());

        logger.debug(`${loggerPrefix} Generating client identity`);
        this.stub = stub;
        const signingId = stub.getCreator();

        this.mspId = signingId.mspid;

        this.idBytes = signingId.idBytes;
        const normalizedCert = normalizeX509(new TextDecoder().decode(this.idBytes), loggerPrefix);

        // assemble the unique ID based on certificate
        const certificate = Certificate.fromPEM(normalizedCert);
        function formatDN(dn) {
            return dn.attributes.map((attribute) => {
                const value = attribute.value.replace('/', '\\/');
                return `/${attribute.shortName}=${value}`;
            }).join('');
        }
        this.id = `x509::${formatDN(certificate.subject)}::${formatDN(certificate.issuer)}`;
        const extension = certificate.extensions.find((ext) => ext.oid === FABRIC_CERT_ATTR_OID);
        this.attrs = {};
        if (extension) {
            const str = extension.value.toString();
            const obj = JSON.parse(str);
            this.attrs = obj.attrs;
        }
        logger.debug(`${loggerPrefix} Generated client identity`, this.mspId, this.attrs, this.id);
    }

    /**
	 * getID returns the ID associated with the invoking identity.  This ID
	 * is guaranteed to be unique within the MSP.
	 * @returns {string} A string in the format: "x509::{subject DN}::{issuer DN}"
	 */
    getID() {
        return this.id;
    }

    /**
	 * Returns the MSP ID of the invoking identity.
	 * @returns {string}
	 */
    getMSPID() {
        return this.mspId;
    }

    /**
	 * getIDBytes returns the ID bytes associated with the invoking identity. If the MSP is
     * implemented with X.509 certificates, then these ID bytes will be those of the X.509
     * certificate. If you wish to inspect the contents of the X.509 certificate, then you
     * must use an X.509 parsing library (for example, jsrsasign or @fidm/x509) to decode
     * these ID bytes.
	 * @returns {Uint8Array}
	 */
    getIDBytes() {
        return this.idBytes;
    }

    /**
	 * getAttributeValue returns the value of the client's attribute named `attrName`.
	 * If the invoking identity possesses the attribute, returns the value of the attribute.
	 * If the invoking identity does not possess the attribute, returns null.
	 * @param {string} attrName Name of the attribute to retrieve the value from the
	 *     identity's credentials (such as X.509 certificate for PKI-based MSPs).
	 * @returns {string | null} Value of the attribute or null if the invoking identity
	 *     does not possess the attribute.
	 */
    getAttributeValue(attrName) {
        const attr = this.attrs[attrName];
        if (attr) {
            return attr;
        } else {
            return null;
        }
    }

    /**
	 * assertAttributeValue verifies that the invoking identity has the attribute named `attrName`
	 * with a value of `attrValue`.
	 * @param {string} attrName Name of the attribute to retrieve the value from the
	 *     identity's credentials (such as X.509 certificate for PKI-based MSPs)
	 * @param {string} attrValue Expected value of the attribute
	 * @returns {boolean} True if the invoking identity possesses the attribute and the attribute
	 *     value matches the expected value. Otherwise, returns false.
	 */
    assertAttributeValue(attrName, attrValue) {
        const attr = this.getAttributeValue(attrName);
        if (attr === null) {
            return false;
        } else if (attrValue === attr) {
            return true;
        } else {
            return false;
        }
    }
}

function parsePeerUrl(url) {
    if (typeof url === 'undefined' || url === '') {
        const errMsg = 'The "peer.address" program argument must be set to a legitimate value of <host>:<port>';
        logger.error(errMsg);
        throw new Error(errMsg);
    } else {
        if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) {
            const errMsg = 'The "peer.address" program argument can not be set to an "http(s)" url, use grpc(s) or omit the protocol';
            logger.error(errMsg);
            throw new Error(errMsg);
        } else {
            // if the url has grpc(s) prefix, use it, otherwise decide based on the TLS enablement
            if (url.indexOf('grpc://') !== 0 && url.indexOf('grpcs://') !== 0) {
                if (isTLS()) {
                    url = 'grpcs://' + url;
                } else {
                    url = 'grpc://' + url;
                }
            }
        }
    }
    logger.debug('Peer URL', url);
    return url;
}

function isTLS() {
    const tls = process.env.CORE_PEER_TLS_ENABLED;
    return typeof tls === 'string' && tls.toLowerCase() === 'true';
}

/*
 * Make sure there's a start line with '-----BEGIN CERTIFICATE-----'
 * and end line with '-----END CERTIFICATE-----', so as to be compliant
 * with X.509 parsers
 */
function normalizeX509(raw, loggerPrefix) {
    logger.debug(`${loggerPrefix} [normalizeX509] raw cert: ${raw}`);
    const regex = /(\-\-\-\-\-\s*BEGIN ?[^-]+?\-\-\-\-\-)([\s\S]*)(\-\-\-\-\-\s*END ?[^-]+?\-\-\-\-\-)/;
    let matches = raw.match(regex);
    if (!matches || matches.length !== 4) {
        throw new Error('Failed to find start line or end line of the certificate.');
    }

    // remove the first element that is the whole match
    matches.shift();
    // remove LF or CR
    matches = matches.map((element) => {
        return element.trim();
    });

    // make sure '-----BEGIN CERTIFICATE-----' and '-----END CERTIFICATE-----' are in their own lines
    // and that it ends in a new line
    return matches.join('\n') + '\n';
}

module.exports = Shim;
// Double exported to provide better experience for TypeScript programmers.
module.exports.Shim = Shim;
module.exports.ClientIdentity = ClientIdentity;

// expose the Stub and Iterators to allow ability to write unit tests for users of fabric chaincode node
// Stub is a legacy alias for ChaincodeStub (the actual name of the class in stub.js)
module.exports.Stub = ChaincodeStub;
module.exports.ChaincodeStub = ChaincodeStub;
module.exports.Iterators = Iterators;
module.exports.HistoryQueryIterator = Iterators.HistoryQueryIterator;
module.exports.StateQueryIterator = Iterators.StateQueryIterator;
module.exports.ChaincodeInterface = ChaincodeInterface;
module.exports.KeyEndorsementPolicy = KeyEndorsementPolicy;
