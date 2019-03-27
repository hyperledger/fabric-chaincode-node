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

const InfoAnnotations = rewire('./../../../lib/annotations/info');
const Info = InfoAnnotations.Info;


describe ('Info.js', () => {

    const mockTarget = {
        name: 'steve', title: 'steve'
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

    describe('Info', () => {

        let info;

        beforeEach(() => {
            info = Info();
        });

        it ('should add object as key when no objects exist for global yet', () => {
            getMetadataStub
                .onFirstCall().returns(undefined);

            info(mockTarget);

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:info', global);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:info',
                {steve: {title: 'steve', version: ''}}
            );
        });

        it ('should add object as key when objects exist for global', () => {
            getMetadataStub
                .onFirstCall().returns({'object1': {}});

            info(mockTarget);

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:info', global);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:info', {
                'object1': {},
                'steve': {title: 'steve', version: ''}
            });
        });
    });
    describe('Info with data', () => {

        let info;

        beforeEach(() => {
            info = Info({title: 'bill', version: '1.0.1'});
        });

        it ('should add object as key when no objects exist for global yet', () => {
            getMetadataStub
                .onFirstCall().returns(undefined);

            info(mockTarget);

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:info', global);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:info',
                {steve:  {title: 'bill', version: '1.0.1'}}
            );
        });

        it ('should add object as key when objects exist for global', () => {
            getMetadataStub
                .onFirstCall().returns({'object1': {}});

            info(mockTarget);

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:info', global);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:info', {
                'object1': {},
                'steve': {title: 'bill', version: '1.0.1'}
            });
        });
    });
});
