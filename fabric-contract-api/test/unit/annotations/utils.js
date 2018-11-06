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
});