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
/* global describe it beforeEach afterEach  */
'use strict';

const chai = require('chai');

const expect = chai.expect;
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));

describe('loading modules', () => {
    it('should load', () => {
        const congtractapi = require('../../index.js');
        expect(congtractapi).to.not.be.null;
    });
});