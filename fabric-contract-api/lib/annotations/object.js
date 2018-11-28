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

require('reflect-metadata');

module.exports.Object = function Object () {
    return (target) => {
        const objects = Reflect.getMetadata('fabric:objects', global) || {};

        const properties = Reflect.getMetadata('fabric:object-properties', target.prototype) || [];

        objects[target.name] = {
            '$id': target.name,
            type: 'object',
            additionalProperties: false,
            properties: properties
        };

        Reflect.defineMetadata('fabric:objects', objects, global);
    };
};

module.exports.Property = function Property (name, type) {
    return (target, propertyKey) => {
        const properties = Reflect.getMetadata('fabric:object-properties', target) || [];

        if (name && type) {
            type = type.toLowerCase();
        } else {
            name = propertyKey;

            const metaType = Reflect.getMetadata('design:type', target, propertyKey);
            type = typeof metaType === 'function' ? metaType.name.toLowerCase() : metaType.toString().toLowerCase();
        }

        properties.push({
            name,
            schema: {
                type
            }
        });

        Reflect.defineMetadata('fabric:object-properties', properties, target);
    };
};
