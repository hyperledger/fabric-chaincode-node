/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';
const getParams = require('get-params');
const utils = require('./utils');
require('reflect-metadata');

module.exports.Transaction = function Transaction(commit = true) {
    return (target, propertyKey) => {
        const transactions = Reflect.getMetadata('fabric:transactions', target) || [];
        const transaction = utils.findByValue(transactions, 'name', propertyKey);
        const paramNames = getParams(target[propertyKey]);
        const description = '';
        const contextType = target.createContext().constructor;
        const paramTypes = Reflect.getMetadata('design:paramtypes', target, propertyKey) || [];

        let numRemoved = 0;
        const parameters = paramTypes.filter((paramType, paramIdx) => {
            const filter = paramType === contextType;

            if (filter) {
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
    };
};

module.exports.Returns = function Returns(returnType) {
    return (target, propertyKey) => {
        const transactions = Reflect.getMetadata('fabric:transactions', target) || [];

        const obj = {
            name: 'success'
        };

        obj.schema = utils.generateSchema(returnType);

        utils.appendOrUpdate(transactions, 'name', propertyKey, {
            returns: [obj]
        });

        Reflect.defineMetadata('fabric:transactions', transactions, target);
    };
};

module.exports.Param = function Param(paramName, paramType, description) {
    return (target, propertyKey) => {
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
