/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const Logger = require('../logger');
const logger = Logger.getLogger('./lib/annotations/default.js');
require('reflect-metadata');

module.exports.Default = function Default () {

    return (target) => {
        logger.info('@Default args:', 'Target ->', target.name);

        let dflt = Reflect.getMetadata('fabric:default', global);

        logger.debug('Existing fabric:default', dflt);

        if (dflt) {
            throw new Error('A default has already been specified');
        }

        const contract = new(target);

        dflt = contract.getName();

        Reflect.defineMetadata('fabric:default', dflt, global);

        logger.debug('Updated fabric:default', dflt);
    };
};
