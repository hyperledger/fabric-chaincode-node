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

const sinon = require('sinon');
const rewire = require('rewire');

const chai = require('chai');
const expect = chai.expect;

const DefaultAnnotations = rewire('./../../../lib/annotations/default');
const Default = DefaultAnnotations.Default;

describe ('Default.js', () => {

    const mockTarget = class {
        constructor() {}

        getName() {
            return 'jeremy';
        }
    };

    let defineMetadataStub;
    let getMetadataStub;
    beforeEach(() => {
        getMetadataStub = sinon.stub(Reflect, 'getMetadata');
        defineMetadataStub = sinon.stub(Reflect, 'defineMetadata');
    });

    afterEach(() => {
        getMetadataStub.restore();
        defineMetadataStub.restore();
    });

    describe('Default', () => {

        let dflt;

        beforeEach(() => {
            dflt = Default();
        });

        it ('should add set value for default when none set', () => {
            getMetadataStub
                .onFirstCall().returns(undefined);

            dflt(mockTarget);

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:default', global);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:default',
                'jeremy'
            );
        });

        it ('should error when default already set', () => {
            getMetadataStub
                .onFirstCall().returns('theresa');

            expect(() => {
                dflt(mockTarget);
            }).to.throw('A default has already been specified');

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:default', global);
            sinon.assert.notCalled(defineMetadataStub);
        });
    });
});