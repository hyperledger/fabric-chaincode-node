/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';
const getParams = require('get-params');
const utils = require('./utils');
const Logger = require('../logger');
const logger = Logger.getLogger('./lib/annotations/object.js');
require('reflect-metadata');

module.exports.Transaction = function Transaction (commit = true) {
    return (target, propertyKey) => {
        logger.debug('@Transaction args:', `Property Key -> ${propertyKey}, Commit -> ${commit},`, 'Target ->', target.constructor.name);

        const transactions = Reflect.getMetadata('fabric:transactions', target) || [];
        const transaction = utils.findByValue(transactions, 'name', propertyKey);
        const paramNames = getParams(target[propertyKey]);

        logger.debug('@Transaction params:', `Property Key -> ${propertyKey}, Param Names ->  ${JSON.stringify(paramNames)},`, 'Target ->', target.constructor.name);

        const description = '';
        const contextType = target.createContext().constructor;

        logger.debug(`Transaction -> ${propertyKey} params`, paramNames);

        const paramTypes = Reflect.getMetadata('design:paramtypes', target, propertyKey) || [];

        let numRemoved = 0;
        const parameters = paramTypes.filter((paramType, paramIdx) => {
            const filter = paramType === contextType;

            if (filter) {
                logger.debug('@Transaction ignoring param as matched context type', `Property Key -> ${propertyKey}, Param Name ->, ${paramNames[paramIdx]},`, 'Target ->', target.constructor.name);
                paramNames.splice(paramIdx - numRemoved++, 1);
            }

            return !filter;
        }).map((paramType, paramIdx) => {
            const paramName = paramNames[paramIdx];
            const obj = {
                name: paramName,
                description
            };

            const type = typeof paramType === 'function' ? paramType.name : paramType.toString();
            if (type === 'Object') {
                throw new Error(`Type not properly specified for parameter ${paramName}, can not process pure Object types`);
            }
            obj.schema = utils.generateSchema(type);

            return obj;
        });

        if (transaction && transaction.parameters) {
            transaction.parameters.forEach((tParam) => {
                for (let i = 0; i < parameters.length; i++) {
                    if (parameters[i].name === tParam.name) {
                        parameters[i] = tParam;
                    }
                }
            });
        }

        const tag = [];
        if (commit) {
            tag.push('submitTx');
        }

        utils.appendOrUpdate(transactions, 'name', propertyKey, {
            tag: tag,
            parameters: parameters
        });

        Reflect.defineMetadata('fabric:transactions', transactions, target);
        logger.debug('Updated fabric:transactions', transactions);
    };
};

module.exports.Returns = function Returns (returnType) {
    return (target, propertyKey) => {
        logger.debug('@Returns args:', `, Property Key -> ${propertyKey}, Return Type -> ${returnType},`, 'Target ->', target.constructor.name);

        const transactions = Reflect.getMetadata('fabric:transactions', target) || [];

        logger.debug('Existing fabric:transactions', transactions);

        utils.appendOrUpdate(transactions, 'name', propertyKey, {
            returns: utils.generateSchema(returnType)
        });

        Reflect.defineMetadata('fabric:transactions', transactions, target);
        logger.debug('Updated fabric:transactions', transactions);
    };
};

module.exports.Param = function Param (paramName, paramType, description) {
    return (target, propertyKey) => {
        logger.info('@Param args:', `Property Key -> ${propertyKey}, Param Name -> ${paramName}, Param Type -> ${paramType}, Description -> ${description},`, 'Target ->', target.constructor.name);

        const transactions = Reflect.getMetadata('fabric:transactions', target) || [];

        const transaction = utils.findByValue(transactions, 'name', propertyKey);

        const paramSchema = utils.generateSchema(paramType);
        const paramDesc = description || '';

        if (transaction && transaction.parameters) {
            const param = utils.findByValue(transaction.parameters, 'name', paramName);

            if (param) {
                param.schema = paramSchema;
                param.description = paramDesc;
            } else {
                transaction.parameters.push({
                    name: paramName,
                    description: paramDesc,
                    schema: paramSchema
                });
            }
        } else {
            utils.appendOrUpdate(transactions, 'name', propertyKey, {
                parameters: [{
                    name: paramName,
                    description: paramDesc,
                    schema: paramSchema
                }]
            });
        }

        Reflect.defineMetadata('fabric:transactions', transactions, target);
    };
};
