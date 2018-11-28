/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';
const getParams = require('get-params');
const utils = require('./utils');
require('reflect-metadata');

// there appears to be confusions within the meta data handling
// whether string or String is correct.
// string is the preferred for JSON Schema
function isPrimitive(type) {
    const lowerCase = type.toLowerCase();
    switch (lowerCase) {
        case 'string':
        case 'number':
        case 'boolean':
            return lowerCase;

        default:
            return undefined;
    }

}

module.exports.Transaction = function Transaction(commit = true) {
    return (target, propertyKey) => {
        const transactions = Reflect.getMetadata('fabric:transactions', target) || [];
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
                description,
                schema: {

                }
            };

            const type = typeof paramType === 'function' ? paramType.name : paramType.toString();

            // for reasons best known to the annotations, the primtive types end up being first letter capitlized
            // where in all other places including Typescript, they are lower case
            // hence this bit of logic

            const checkedType = isPrimitive(type);
            if (checkedType) {
                obj.schema.type = checkedType;
            } else {
                obj.schema.$ref = `#/components/schemas/${type}`;
            }

            return obj;
        });

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
            name: 'success',
            schema: {

            }
        };

        const checkedType = isPrimitive(returnType);
        if (checkedType) {
            obj.schema.type = checkedType;
        } else {
            obj.schema.$ref = `#/components/schemas/${returnType}`;
        }

        utils.appendOrUpdate(transactions, 'name', propertyKey, {
            returns: [obj]
        });

        Reflect.defineMetadata('fabric:transactions', transactions, target);
    };
};
