/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const refPath = '#/components/schemas/';

module.exports.appendOrUpdate = function appendOrUpdate(arr, primaryField, id, data) {
    const objExists = arr.some((obj) => {
        if (obj[primaryField] === id) {
            Object.assign(obj, data);
            return true;
        }
    });

    if (!objExists) {
        const obj = data;
        data[primaryField] = id;
        arr.push(obj);
    }
};

module.exports.findByValue = function findByValue(arr, primaryField, id) {
    for (const el of arr) {
        if (el[primaryField] === id) {
            return el;
        }
    }

    return null;
};

const generateSchema = (type, fullPath = true) => {
    if (isPrimitive(type)) {
        return {
            type: type.toLowerCase()
        };
    } else if (isArray(type)) {
        const subType = getSubArray(type);

        return  {
            type: 'array',
            items: generateSchema(subType, fullPath)
        };
    } else if (isMap(type)) {
        const subType = getSubMap(type);

        return {
            type: 'object',
            additionalProperties: generateSchema(subType, fullPath)
        };
    }

    return {
        $ref: (fullPath ? refPath : '') + type
    };
};
module.exports.generateSchema = generateSchema;

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

// Like Array<number>
function isArrowedArray(type) {
    return /^Array<[A-z].*>$/.test(type);
}

// Like number[]
function isBracketArray(type) {
    return /^[A-z].*(\[\])+?/.test(type);
}

// determine if string representation of type
// is in format of an arrray descriptor
function isArray(type) {
    return isArrowedArray(type) || isBracketArray(type);
}

function getSubArray(type) {
    if (isArrowedArray(type)) {
        return type.replace('Array<', '').replace('>', '');
    }

    return type.replace('[]', '');
}

function isMap(type) {
    return /^Map<[A-z].*,\s?[A-z].*>$/.test(type);
}

function getSubMap(type) {
    return type.replace(/^Map<[A-z].*?,\s?/, '').replace('>', '');
}
