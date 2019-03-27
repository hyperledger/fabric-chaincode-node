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
const logger = Logger.getLogger('./lib/annotations/info.js');
require('reflect-metadata');

module.exports.Info = function Info (info = {}) {
    return (target) => {
        logger.debug('@Info args:', `Info -> ${info},`, 'Target ->', target.name);

        const data = Reflect.getMetadata('fabric:info', global) || {};

        logger.debug('Existing fabric:info', data);

        if (!info.title) {
            info.title = target.title;
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

