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
'use strict';
const sinon = require('sinon');

before(() => {
    process.on('unhandledRejection', (e) => {
        if (!/__PERMITTED__/.test(e.message)) {
            sinon.assert.fail(`You forgot to return a Promise! Check your tests! ${e.message}`);
        } else {
            // permitted unhandled rection
            console.log('Ignoring unhandled rejection as it is marked as __PERMITTED__ ');
        }
    });
});