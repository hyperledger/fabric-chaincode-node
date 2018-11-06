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
        const paramNames = getParams(target[propertyKey]);
        const description = '';
        const paramTypes = Reflect.getMetadata('design:paramtypes', target, propertyKey) || [];
        const parameters = paramTypes.map((paramType, paramIdx) => {
            const paramName = paramNames[paramIdx];
            if (typeof paramType === 'function') {
                return {
                    name: paramName,
                    description,
                    schema: {
                        type: paramType.name.toLowerCase()
                    }
                };
            } else {
                return {
                    name: paramName,
                    description,
                    schema: {
                        type: paramType.toString().toLowerCase()
                    }
                };
            }
        });

        const tag = [];
        if (commit) {
            tag.push('submitTx');
        }

        utils.appendOrUpdate(transactions, 'transactionId', propertyKey, {
            tag: tag,
            parameters: parameters
        });

        Reflect.defineMetadata('fabric:transactions', transactions, target);
    };
};

module.exports.Returns = function Returns(returnType) {
    return (target, propertyKey) => {
        const transactions = Reflect.getMetadata('fabric:transactions', target) || [];

        utils.appendOrUpdate(transactions, 'transactionId', propertyKey, {
            returns: returnType.toLowerCase()
        });

        Reflect.defineMetadata('fabric:transactions', transactions, target);
    };
};