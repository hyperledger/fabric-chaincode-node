/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const Logger = require('../logger');
const logger = Logger.getLogger('./lib/annotations/info.js');
require('reflect-metadata');

module.exports.Info = function Info (info = {}) {
    return (target) => {
        logger.info('@Info args:', `Info -> ${info},`, 'Target ->', target.name);

        const data = Reflect.getMetadata('fabric:info', global) || {};

        logger.debug('Existing fabric:info', data);

        if (!info.name) {
            info.name = target.name;
        }
        if (!info.version) {
            info.version = '';
        }

        data[target.name] = {};
        Object.assign(data[target.name], info);

        Reflect.defineMetadata('fabric:info', data, global);

        logger.debug('Updated fabric:info', data);
    };
};

