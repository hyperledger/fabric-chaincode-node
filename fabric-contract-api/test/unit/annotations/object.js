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

const ObjectAnnotations = rewire('./../../../lib/annotations/object');
const Object = ObjectAnnotations.Object;
const Property = ObjectAnnotations.Property;

class SuperAsset {

}

class SubAsset extends SuperAsset {

}
describe('Object.js', () => {


    const mockTarget = new SubAsset();
    mockTarget.name = 'steve';

    let sandbox;
    let defineMetadataStub;
    let getMetadataStub;
    let getOwnMetadataStub;
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        getMetadataStub = sandbox.stub(Reflect, 'getMetadata');
        getOwnMetadataStub = sandbox.stub(Reflect, 'getOwnMetadata');
        defineMetadataStub = sandbox.stub(Reflect, 'defineMetadata');
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#Object', () => {

        let object;

        beforeEach(() => {
            object = Object();
        });

        it('', () => {
            const fn = ObjectAnnotations.__get__('getProto');
            fn(String);
        });

        it('should add object as key when no objects exist for global yet', () => {
            getMetadataStub
                .onFirstCall().returns(undefined)
                .onSecondCall().returns({'some': 'properties'});

            object(SubAsset);

            sinon.assert.calledTwice(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:objects', global);
            sinon.assert.calledWith(getMetadataStub, 'fabric:object-properties', SubAsset.prototype);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:objects', {
                SubAsset:{
                    $id: 'SubAsset',
                    allOf: [{properties: {some: 'properties'}, type: 'object'}, {$ref: 'SuperAsset'}],
                    cnstr: SubAsset

                }
            }, sinon.match.any
            );
        });

        it('should add object as key when objects exist for global', () => {
            getMetadataStub
                .onFirstCall().returns({'object1': {}})
                .onSecondCall().returns(undefined);

            object(SubAsset);

            sinon.assert.calledTwice(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:objects', global);
            sinon.assert.calledWith(getMetadataStub, 'fabric:object-properties', SubAsset.prototype);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:objects', {
                'object1': {},
                SubAsset:{
                    $id: 'SubAsset',
                    allOf: [{properties: {}, type: 'object'}, {$ref: 'SuperAsset'}],
                    cnstr: SubAsset

                }
            }, sinon.match.any
            );
        });

        it('should add object with no supertype', () => {
            getMetadataStub
                .onFirstCall().returns(undefined)
                .onSecondCall().returns({'some': 'properties'});

            new Object({discriminator:'type'})(SuperAsset);

            sinon.assert.calledTwice(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:objects', global);
            sinon.assert.calledWith(getMetadataStub, 'fabric:object-properties', SuperAsset.prototype);
            sinon.assert.calledOnce(defineMetadataStub);
        });


        it('should add object with no supertype, and no expected subtypes', () => {
            getMetadataStub
                .onFirstCall().returns(undefined)
                .onSecondCall().returns({'some': 'properties'});

            new Object()(SuperAsset);

            sinon.assert.calledTwice(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:objects', global);
            sinon.assert.calledWith(getMetadataStub, 'fabric:object-properties', SuperAsset.prototype);
            sinon.assert.calledOnce(defineMetadataStub);

        });

    });

    describe('#Property', () => {

        it('should use the type and name passed', () => {
            getOwnMetadataStub.onFirstCall().returns({'some': 'properties'});

            Property('some name', 'SoMe tYPe')(mockTarget);

            sinon.assert.calledOnce(getOwnMetadataStub);
            sinon.assert.calledWith(getOwnMetadataStub, 'fabric:object-properties', mockTarget);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:object-properties', {
                'some': 'properties',
                'some name': {
                    '$ref': 'SoMe tYPe'
                }
            }, mockTarget);
        });

        it('should handle the reflected type being a function when type not passed', () => {
            getOwnMetadataStub
                .onFirstCall().returns(undefined);
            getMetadataStub
                .onFirstCall().returns(function Fred () { });


            Property('some name')(mockTarget, 'some key');
            sinon.assert.calledOnce(getOwnMetadataStub);
            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getOwnMetadataStub, 'fabric:object-properties', mockTarget);
            sinon.assert.calledWith(getMetadataStub, 'design:type', mockTarget, 'some key');

            sinon.assert.calledWith(defineMetadataStub, 'fabric:object-properties', {
                'some key': {
                    $ref: 'Fred'
                }
            }, mockTarget);
        });

        it('should handle the reflected type being a function when type not passed', () => {
            getOwnMetadataStub
                .onFirstCall().returns(undefined);
            getMetadataStub
                .onFirstCall().returns('soMe TyPe');


            Property()(mockTarget, 'some key');
            sinon.assert.calledOnce(getOwnMetadataStub);
            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getOwnMetadataStub, 'fabric:object-properties', mockTarget);
            sinon.assert.calledWith(getMetadataStub, 'design:type', mockTarget, 'some key');

            sinon.assert.calledWith(defineMetadataStub, 'fabric:object-properties', {
                'some key': {
                    '$ref': 'soMe TyPe'
                }
            }, mockTarget
            );
        });
    });

});
