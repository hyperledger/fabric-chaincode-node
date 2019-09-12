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

/* global describe it  */
'use strict';

const chai = require('chai');
const expect = chai.expect;

const utils = require('../../../lib/annotations/utils');

describe('utils', () => {
    describe('appendOrUpdate', () => {
        it('should push a new object into array made up of data passed if none existing with id', () => {
            const existingObj = {
                someField: 'an id',
                anotherField: 'a value',
                furtherField: 'a further value'
            };

            const arr = [existingObj];

            utils.appendOrUpdate(arr, 'someField', 'some id', {
                anotherField: 'another value',
                furtherField: 'further value'
            });

            expect(arr).to.have.length(2);
            expect(arr[0]).to.deep.equal(existingObj);
            expect(arr[1]).to.deep.equal({
                someField: 'some id',
                anotherField: 'another value',
                furtherField: 'further value'
            });
        });

        it('should update existing object with data if id exists', () => {
            const existingObj = {
                someField: 'some id',
                anotherField: 'a value',
                furtherField: 'a further value'
            };

            const arr = [existingObj];

            utils.appendOrUpdate(arr, 'someField', 'some id', {
                additionalField: 'additional value'
            });

            expect(arr).to.have.length(1);
            expect(arr[0]).to.deep.equal({
                someField: 'some id',
                anotherField: 'a value',
                furtherField: 'a further value',
                additionalField: 'additional value'
            });
        });
    });

    describe('findByValue', () => {
        const testArray = [{
            name: 'jim',
            value: 100
        }, {
            name: 'bob',
            value: 200
        }];

        it ('should return the element in the array with the passed value in the passed field', () => {
            expect(utils.findByValue(testArray, 'name', 'jim')).to.deep.equal(testArray[0]);
        });

        it ('should return null if no element has the passed value for the passed field', () => {
            expect(utils.findByValue(testArray, 'name', 'alan')).to.be.null;
        });
    });

    describe('generateSchema', () => {

        it ('should return a primitive type', () => {
            expect(utils.generateSchema('string')).to.deep.equal({
                type: 'string'
            });

            expect(utils.generateSchema('number')).to.deep.equal({
                type: 'number'
            });

            expect(utils.generateSchema('boolean')).to.deep.equal({
                type: 'boolean'
            });
        });

        it ('should return a primitive type as lowercase', () => {
            expect(utils.generateSchema('sTRiNg')).to.deep.equal({
                type: 'string'
            });
        });

        it ('should return a ref path for a non array and non primitive type', () => {
            expect(utils.generateSchema('Duck')).to.deep.equal({
                $ref: '#/components/schemas/Duck'
            });
        });

        it ('should return a ref path for a non array and non primitive type and not use full path', () => {
            expect(utils.generateSchema('Duck', false)).to.deep.equal({
                $ref: 'Duck'
            });
        });

        it ('should recurse for array types', () => {
            expect(utils.generateSchema('Duck[]')).to.deep.equal({
                type: 'array',
                items: {
                    $ref: '#/components/schemas/Duck'
                }
            });

            expect(utils.generateSchema('Array<Duck>')).to.deep.equal({
                type: 'array',
                items: {
                    $ref: '#/components/schemas/Duck'
                }
            });

            expect(utils.generateSchema('Array<Duck>', false)).to.deep.equal({
                type: 'array',
                items: {
                    $ref: 'Duck'
                }
            });

            expect(utils.generateSchema('Array<string>')).to.deep.equal({
                type: 'array',
                items: {
                    type: 'string'
                }
            });

            expect(utils.generateSchema('Array<string[]>')).to.deep.equal({
                type: 'array',
                items: {
                    type: 'array',
                    items: {
                        type: 'string'
                    }
                }
            });

            expect(utils.generateSchema('Array<Array<string>>')).to.deep.equal({
                type: 'array',
                items: {
                    type: 'array',
                    items: {
                        type: 'string'
                    }
                }
            });
        });

        it ('should recurse for map types', () => {
            expect(utils.generateSchema('Map<string, Duck>')).to.deep.equal({
                type: 'object',
                additionalProperties: {
                    $ref: '#/components/schemas/Duck'
                }
            });

            expect(utils.generateSchema('Map<string, number>')).to.deep.equal({
                type: 'object',
                additionalProperties: {
                    type: 'number'
                }
            });

            expect(utils.generateSchema('Map<string, Map<string, number>>')).to.deep.equal({
                type: 'object',
                additionalProperties: {
                    type: 'object',
                    additionalProperties: {
                        type: 'number'
                    }
                }
            });
        });
    });
});