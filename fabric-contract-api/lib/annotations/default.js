/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const Logger = require('../logger');
const logger = Logger.getLogger('./lib/annotations/default.js');
require('reflect-metadata');

module.exports.Default = function Default () {

    return (target) => {
        logger.debug('@Default args:', 'Target ->', target.name);

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