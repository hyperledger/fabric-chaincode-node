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
    constructor(contractClasses) {

        const Contract = require('fabric-contract-api').Contract;
        const SystemContract = require('./systemcontract');

        // the structure that stores the 'function-pointers', contents of the form
        // {  namespace : { ContractClass,  Contract,  transactions[] }}
        this.contracts = {};

        if (!contractClasses) {
            throw new Error('Missing argument: array of contract classes');
        }
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
                        transactionId: propName
                    });
                }
            }
            const namespace = contract.getNamespace();
            logger.debug(transactions, contractClass, namespace);

            this.contracts[`${namespace}`] = {contractClass, transactions, contract};
        }
        const opts = StartCommand.getArgs(yargs);
        const modPath = path.resolve(process.cwd(), opts['module-path']);
        const jsonPath = path.resolve(modPath, 'package.json');

        const json = require(jsonPath);

        this.version = json.hasOwnProperty('version') ? json.version : '';
        this.title = json.hasOwnProperty('name') ? json.name : '';
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
            const {namespace:ns, function:fn} = this._splitFunctionName(fAndP.fcn);

            if (!this.contracts[ns]) {
                throw new Error(`Namespace is not known :${ns}:`);
            }

            const contractInstance = this.contracts[ns].contract;
            const ctx = contractInstance.createContext();
            ctx.setChaincodeStub(stub);
            ctx.setClientIdentity(new ClientIdentity(stub));

            const functionExists = this.contracts[ns].transactions.some((transaction) => {
                return transaction.transactionId === fn;
            });
            if (functionExists) {
                // before tx fn
                await contractInstance.beforeTransaction(ctx);

                // use the spread operator to make this pass the arguments seperately not as an array
                let result = await contractInstance[fn](ctx, ...fAndP.params);

                // after tx fn
                await contractInstance.afterTransaction(ctx, result);

                if (Buffer.isBuffer(result)) {
                    result = JSON.stringify([...result]);
                } else if (Array.isArray(result)) {
                    result = JSON.stringify(result);
                } else {
                    result = String(result);
                }

                result = Buffer.from(result);
                return shim.success(result);
            } else {
                await contractInstance.unknownTransaction(ctx);
            }
        } catch (error) {
            return shim.error(error);
        }
    }

    /**
	 * Parse the fcn name to be namespace and function.  These are separated by a :
	 * Anything after the : is treated as the function name
	 * No : implies that the whole string is a function name
	 *
	 * @param {String} fcn the combined function and name string
	 * @return {Object} split into namespace and string
	 */
    _splitFunctionName(fcn) {
        // Did consider using a split(':') call to do this; however I chose regular expression for
        // the reason that it provides definitive description.
        // Split will just split - you would then need to write the code to handle edge cases
        // for no input, for multiple :, for multiple : without intervening characters
        // https://regex101.com/ is very useful for understanding

        const regex = /([^:]*)(?::|^)(.*)/g;
        const result = {namespace:'', function:''};

        const m = regex.exec(fcn);
        result.namespace = m[1];
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
            components: {}
        };

        for (const c in this.contracts) {
            const contract = this.contracts[c];
            const contractData = {
                info: {
                    title: contract.contract.getNamespace(),
                    version: this.version
                },
                transactions: []
            };

            contractData.namespace = contract.contract.getNamespace();

            contract.transactions.forEach((tx) => {
                contractData.transactions.push(tx);
            });

            data.contracts.push(contractData);
        }

        return data;
    }

}

module.exports = ChaincodeFromContract;
