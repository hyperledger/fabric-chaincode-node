/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const shim = require('../chaincode');

const Logger = require('../logger');
const logger = Logger.getLogger('contracts-spi/chaincodefromcontract.js');
const StartCommand = require('../cmds/startCommand.js');
const DataMarshall = require('./datamarshall.js');
const ClientIdentity = require('../chaincode').ClientIdentity;

const yargs = require('yargs');
const path = require('path');

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
     * @param {Contract[]} contractClasses array of  contracts to register
     */
    constructor(contractClasses, serializers) {

        if (!contractClasses) {
            throw new Error('Missing argument: array of contract classes');
        }

        if (!serializers) {
            throw new Error('Missing argument: serialization implement information');
        }

        const Contract = require('fabric-contract-api').Contract;
        const SystemContract = require('./systemcontract');

        // the structure that stores the 'function-pointers', contents of the form
        // {  name : { ContractClass,  Contract,  transactions[] }}
        this.contracts = {};
        this.serializers = serializers;

        // always add in the 'meta' class that has general abilities
        contractClasses.push(SystemContract);
        logger.debug(contractClasses);

        for (const contractClass of contractClasses) {

            const contract = new(contractClass);
            if (!(contract instanceof Contract)) {
                throw new Error(`invalid contract instance ${contract}`);
            }

            if (contract instanceof SystemContract) {
                contract._setChaincode(this);
            }

            const transactions = Reflect.getMetadata('fabric:transactions', contract) || [];

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
                    }

                    transactions.push({
                        name: propName
                    });
                }
            }
            const name = contract.getName();
            logger.debug(transactions, contractClass, name);

            // determine the serialization structure that is needed for this contract
            // create and store the dataMarshall that is needed
            const requestedSerializer = serializers.transaction;
            const dataMarshall = new DataMarshall(requestedSerializer, serializers.serializers);

            this.contracts[`${name}`] = {contractClass, transactions, contract, dataMarshall};
        }


        const opts = StartCommand.getArgs(yargs);
        const modPath = path.resolve(process.cwd(), opts['module-path']);
        const jsonPath = path.resolve(modPath, 'package.json');

        const json = require(jsonPath);

        this.version = json.hasOwnProperty('version') ? json.version : '';
        this.title = json.hasOwnProperty('name') ? json.name : '';
        this.objects = Reflect.getMetadata('fabric:objects', global) || {};
    }

    /**
     * The init fn is called for updated and init operations; the user though can include any function
     * in these calls. Therefore we are giving the user the responsibility to put the correct function in
     *
     * @param {ChaincodeStub} stub Stub class giving the full api
     */
    async Init(stub) {
        const fAndP = stub.getFunctionAndParameters();
        if (fAndP.fcn === '') {
            const message = 'Default initiator successful.';
            return shim.success(Buffer.from(message));
        } else {
            return this.invokeFunctionality(stub, fAndP);
        }
    }

    /**
     * The invoke fn is called for all the invoke operations
     *
     * @param {ChaincodeStub} stub Stub class giving the full api
     */
    async Invoke(stub) {
        const fAndP = stub.getFunctionAndParameters();
        return this.invokeFunctionality(stub, fAndP);
    }

    /**
     * The invokeFunctionality function is called for all the invoke operations; init is also redirected to here
     *
     * @param {ChaincodeStub} stub Stub class giving the full api
	 * @param {Object} fAndP Function and Paramters obtained from the smart contract argument
     */
    async invokeFunctionality(stub, fAndP) {
        try {
            const {contractName:cn, function:fn} = this._splitFunctionName(fAndP.fcn);

            if (!this.contracts[cn]) {
                throw new Error(`Contract name is not known :${cn}:`);
            }

            const contractInstance = this.contracts[cn].contract;
            const dataMarshall = this.contracts[cn].dataMarshall;
            const ctx = contractInstance.createContext();

            ctx.setChaincodeStub(stub);
            ctx.setClientIdentity(new ClientIdentity(stub));

            const functionExists = this.contracts[cn].transactions.some((transaction) => {
                return transaction.name === fn;
            });

            if (functionExists) {
                // before tx fn
                await contractInstance.beforeTransaction(ctx);

                // use the spread operator to make this pass the arguments seperately not as an array
                const result = await contractInstance[fn](ctx, ...fAndP.params);

                // after tx fn
                await contractInstance.afterTransaction(ctx, result);

                return shim.success(dataMarshall.toWireBuffer(result));
            } else {
                await contractInstance.unknownTransaction(ctx);
            }
        } catch (error) {
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
        const result = {contractName:'', function:''};

        const m = regex.exec(fcn);
        result.contractName = m[1];
        result.function = m[2];

        return result;
    }

    /**
	 * get information on the contracts
	 */
    getContracts() {
        const data = {
            info: {
                title: this.title,
                version: this.version
            },
            contracts: [],
            components: {
                schemas: this.objects
            }
        };

        if (Object.keys(this.objects).length === 0) {
            delete data.components.schemas;
        }

        for (const c in this.contracts) {
            const contract = this.contracts[c];
            const contractData = {
                info: {
                    title: contract.contract.getName(),
                    version: this.version
                },
                transactions: []
            };

            contractData.name = contract.contract.getName();

            contract.transactions.forEach((tx) => {
                contractData.transactions.push(tx);
            });

            data.contracts.push(contractData);
        }

        return data;
    }

}

module.exports = ChaincodeFromContract;
