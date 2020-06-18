/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const shim = require('../chaincode');

const utils = require('../utils/utils');
const Logger = require('../logger');
const logger = Logger.getLogger('contracts-spi/chaincodefromcontract.js');
const DataMarshall = require('./datamarshall.js');
const ClientIdentity = require('../chaincode').ClientIdentity;
const Ajv = require('ajv');

require('reflect-metadata');

/**
 * The user will have written a class than extends the 'Contract' interface; this
 * is expressed in terms of domain specific functions - that need to be called in the
 * lower-level 'invoke' and 'init' functions.
 *
 * This class implements the 'invoke' and 'init' functions and does the 'routing'
 * @ignore
 **/
class ChaincodeFromContract {

    /**
     * Takes an array contract classes, and looks for the functions within those files.
     * Stores a reference to those, so they can be specifically called at a later time
     *
     * @param {Contract[]} contractClasses array of contracts to register
     */
    constructor(contractClasses, serializers, metadata = {}, title, version) {

        if (!contractClasses) {
            throw new Error('Missing argument: array of contract classes');
        }
        if (!serializers) {
            throw new Error('Missing argument: serialization implement information');
        }

        this.serializers = serializers;
        logger.debug('Using serializers', serializers);


        this.title = title;
        this.version = version;

        // always add in the 'meta' class that has general abilities
        const SystemContract = require('./systemcontract');
        contractClasses.push(SystemContract);

        // Produce the internal data structure that represents the code that is
        // loaded.This should be optimized for the invocation of functions at runtime
        this.contractImplementations = this._resolveContractImplementations(contractClasses);


        // validate the supplied metadata against what code we have (just in case)
        const errors = this._checkAgainstSuppliedMetadata(metadata);
        if (errors.length > 0) {
            throw new Error(JSON.stringify(errors));
        }

        // process the metadata. If nothing supplied the code has to be introspected
        // as much as possible
        this.metadata = this._augmentMetadataFromCode(metadata);

        // really do not like this method of duplicating an object
        // But it works and is quick (allegedly)
        const systemContract = this.contractImplementations['org.hyperledger.fabric'].contractInstance;

        systemContract._setMetadata(JSON.parse(JSON.stringify(this.metadata)));

        // compile the schemas, and in addition sets upt eh data marhsalls with this information
        this._compileSchemas();

    }

    /**
     * Compile the complex object schemas into validator functions that can be used
     * for arguments.
     */
    _compileSchemas() {

        const schemaList = [];
        for (const name in  this.metadata.components.schemas) {
            const s =  this.metadata.components.schemas[name];

            schemaList.push(s);
        }

        if (schemaList.length > 0) {
            // provide the list of schemas (of the complex types) to AJV, identified by name

            const ajv = this._ajv(schemaList);
            // create validators for each complex type
            // have lowercases the ids
            this.contractImplementations.schemas = {};
            schemaList.forEach((e) => {
                const id = e.$id;
                this.contractImplementations.schemas[id] = {};
                this.contractImplementations.schemas[id].validator = ajv.getSchema(id);
            });

        }
        // final step is to setup up data marhsall instances
        const requestedSerializer = this.serializers.transaction;
        for (const contractName in this.contractImplementations) {
            // determine the serialization structure that is needed for this contract
            // create and store the dataMarshall that is needed
            const dataMarshall = this._dataMarshall(requestedSerializer);
            this.contractImplementations[contractName].dataMarshall = dataMarshall;
        }
    }
    /* istanbul ignore next */
    _dataMarshall(requestedSerializer) {
        return new DataMarshall(requestedSerializer, this.serializers.serializers, this.metadata.components.schemas);
    }
    /* istanbul ignore next */
    _ajv(schemaList) {
        return new Ajv({
            useDefaults: true,
            coerceTypes: false,
            allErrors: true,
            schemas: schemaList
        });
    }

    /**
     * TODO: Review the supplied metadata and check that the functions that have been given are the same ones as have been supplied
     */
    _checkAgainstSuppliedMetadata(metadata) {
        const errors = [];

        if (metadata.contracts) {
            const contracts = JSON.parse(JSON.stringify(this.contractImplementations));
            for (const contractKey in contracts) {
                if (!metadata.contracts[contractKey]) {
                    errors.push(`Missing contract ${contractKey} in metadata`);
                }
            }
        }

        return errors;
    }

    /**
     * Load the contract implementation code
     */
    _resolveContractImplementations(contractClasses) {
        logger.debug('Supplied contract classes', contractClasses);
        this.defaultContractName = Reflect.getMetadata('fabric:default', global);

        const Contract = require('fabric-contract-api').Contract;

        const implementations = {};

        for (const contractClass of contractClasses) {
            const contract = new (contractClass);
            if (!(Contract._isContract(contract))) {
                throw new Error(`invalid contract instance ${JSON.stringify(contract)}`);
            }

            const name = contract.getName();
            if (!this.defaultContractName) {
                this.defaultContractName = name;
                contract.default = true;
            } else if (this.defaultContractName === contract.getName()) {
                contract.default = true;
            }

            implementations[name] = {name, contractInstance: contract};

        }
        return implementations;
    }

    /** Create the standard method from the code that has been loaded
     * This can use introspection and, if applicable, typescript annotations
     */
    _augmentMetadataFromCode(metadata) {

        if (!metadata.$schema) {
            metadata.$schema = 'https://hyperledger.github.io/fabric-chaincode-node/release-2.1/api/contract-schema.json';
        }

        if (!metadata.contracts || Object.keys(metadata.contracts).length === 0) {
            logger.debug('_augmentMetadataFromCode - Contracts not supplied. Generating default');

            const Contract = require('fabric-contract-api').Contract;
            const skipNames = Object.getOwnPropertyNames(Contract.prototype);

            metadata.contracts = JSON.parse(JSON.stringify(this.contractImplementations));

            for (const contractKey in metadata.contracts) {
                const contract = metadata.contracts[contractKey];

                for (const instanceKey in contract.contractInstance) {
                    if (instanceKey.startsWith('_')) {
                        delete contract.contractInstance[instanceKey];
                    }
                }

                const impl = this.contractImplementations[contractKey].contractInstance;

                contract.transactions = this._processContractTransactions(impl, skipNames);
                contract.info = this._processContractInfo(impl);
            }
        }

        // look for the general information representing all the contracts
        // add if nothing has been given by the application
        if (!metadata.info) {
            logger.debug('_augmentMetadataFromCode - Info not supplied. Generating default');
            metadata.info = {};
            metadata.info.version = this.version ? this.version : '';
            metadata.info.title = this.title ? this.title : '';
        }

        // obtain the information relating to the complex objects
        if (!metadata.components) {
            logger.debug('_augmentMetadataFromCode - Components not supplied. Generating default');
            metadata.components = {};
            metadata.components.schemas = Reflect.getMetadata('fabric:objects', global) || {};
        }

        return metadata;
    }

    /** read the code and create the internal structure representing the code */
    _processContractTransactions(contract, ignore) {
        let transactions = [];
        transactions = Reflect.getMetadata('fabric:transactions', contract) || [];
        if (transactions.length === 0) {
            const propNames = Object.getOwnPropertyNames(Object.getPrototypeOf(contract));

            for (const propName of propNames) {
                const propValue = contract[propName];
                if (typeof propValue !== 'function') {
                    continue;
                } else if (propName === 'constructor') {
                    continue;
                } else if (propName.startsWith('_')) {
                    continue;
                } else if (ignore.includes(propName)) {
                    continue;
                }

                const transaction = {
                    name: propName
                };

                if (contract.getName() !== 'org.hyperledger.fabric') {
                    transaction.tags = ['submitTx'];
                }

                // add 'argN' parameters, skipping the first (stub) parameter
                if (propValue.length > 1) {
                    transaction.parameters = [];
                    for (let param = 1; param < propValue.length; param++) {
                        transaction.parameters.push({
                            name: `arg${param - 1}`,
                            description: `Argument ${param - 1}`,
                            schema: {
                                type: 'string'
                            }
                        });
                    }
                }

                transactions.push(transaction);
            }
        }

        logger.debug('Transactions for contract ' + contract.name, transactions);

        return transactions;
    }

    /**
     * get information on this contract
     * @param {*} contract
     */
    _processContractInfo(contract) {

        const info = Reflect.getMetadata('fabric:info', global) || {};
        if (info[contract.constructor.name]) {
            return info[contract.constructor.name];
        } else {
            return {
                title: '',
                version: ''
            };
        }
    }

    /**
     * The init fn is called for updated and init operations; the user though can include any function
     * in these calls. Therefore we are giving the user the responsibility to put the correct function in
     *
     * @param {ChaincodeStub} stub Stub class giving the full api
     */
    async Init(stub) {
        return this.invokeFunctionality(stub);
    }

    /**
     * The invoke fn is called for all the invoke operations
     *
     * @param {ChaincodeStub} stub Stub class giving the full api
     */
    async Invoke(stub) {
        return this.invokeFunctionality(stub);
    }

    /**
     * The invokeFunctionality function is called for all the invoke operations; init is also redirected to here
     *
     * @param {ChaincodeStub} stub Stub class giving the full api
	 * @param {Object} fAndP Function and Paramters obtained from the smart contract argument
     */
    async invokeFunctionality(stub) {
        const bufferArgs = stub.getBufferArgs();
        if ((!bufferArgs) || (bufferArgs.length < 1)) {
            const message = 'Default initiator successful.';
            return shim.success(Buffer.from(message));
        }

        const fAndP = bufferArgs[0].toString();
        const txArgs = bufferArgs.slice(1);

        const txID = stub.getTxID();
        const channelID = stub.getChannelID();
        const loggerPrefix = utils.generateLoggingPrefix(channelID, txID);
        try {
            const {contractName: cn, function: fn} = this._splitFunctionName(fAndP);
            logger.debug(`${loggerPrefix} Invoking ${cn} ${fn}`);

            const contractData = this.contractImplementations[cn];
            if (!contractData) {
                throw new Error(`Contract name is not known: ${cn}`);
            }

            const transactionDescriptor = this.metadata.contracts[cn];

            const contractInstance = contractData.contractInstance;
            const dataMarshall = contractData.dataMarshall;

            // setup the transaction context that is passed to each transaction function
            const ctx = contractInstance.createContext();
            ctx.setChaincodeStub(stub);
            ctx.setClientIdentity(new ClientIdentity(stub));
            ctx.logging = {
                setLevel : Logger.setLevel,
                getLogger : (name) => {
                    return Logger.getLogger(name ? `${cn}:${name}` : cn);
                }
            };

            // get the specific information for this tx function
            const functionExists = transactionDescriptor.transactions.find((transaction) => {
                return transaction.name === fn;
            });

            // if the function exists, then we can call it otherwise, call the unkownn tx handler
            if (functionExists) {

                // marhsall the parameters into the correct types for hanlding by
                // the tx function
                const parameters = dataMarshall.handleParameters(functionExists, txArgs, loggerPrefix);

                // before tx
                await contractInstance.beforeTransaction(ctx);

                // use the spread operator to make this pass the arguments seperately not as an array
                // this is the point at which control is handed to the tx function
                const result = await contractInstance[fn](ctx, ...parameters);

                // after tx fn, assuming that the smart contract hasn't gone wrong
                await contractInstance.afterTransaction(ctx, result);

                let returnSchema = {};
                // javascript/typescript so there will only be one type
                if (functionExists.returns) {
                    returnSchema = functionExists.returns;
                }

                // returnSchema can be undefined if there is no return value - the datamarshall can handle that
                // return the data value, if any to the shim. Including converting the result to the wire format
                return shim.success(dataMarshall.toWireBuffer(result, returnSchema.schema, loggerPrefix));
            } else {
                try {
                    // if we've never heard of this function, then call the unknown tx function
                    await contractInstance.unknownTransaction(ctx);
                    return shim.success();
                } catch (error) {
                    return shim.error(error);
                }
            }

        } catch (error) {
            // log the error and then fail the transaction
            logger.error(`${loggerPrefix} ${error.toString()}`);
            return shim.error(error);
        }
    }

    /**
	 * Parse the fcn name to be name and function.  These are separated by a :
	 * Anything after the : is treated as the function name
	 * No : implies that the whole string is a function name
	 *
	 * @param {String} fcn the combined function and name string
	 * @return {Object} split into name and string
	 */
    _splitFunctionName(fcn) {
        // Did consider using a split(':') call to do this; however I chose regular expression for
        // the reason that it provides definitive description.
        // Split will just split - you would then need to write the code to handle edge cases
        // for no input, for multiple :, for multiple : without intervening characters
        // https://regex101.com/ is very useful for understanding

        const regex = /([^:]*)(?::|^)(.*)/g;
        const result = {contractName: '', function: ''};

        const m = regex.exec(fcn);
        result.contractName = m[1];
        result.function = m[2];

        if (!result.contractName || result.contractName.trim() === '') {
            result.contractName = this.defaultContractName;
        }

        return result;
    }

}

module.exports = ChaincodeFromContract;
