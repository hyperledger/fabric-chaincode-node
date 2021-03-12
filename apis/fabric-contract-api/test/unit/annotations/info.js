/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const sinon = require('sinon');
const rewire = require('rewire');

const InfoAnnotations = rewire('./../../../lib/annotations/info');
const Info = InfoAnnotations.Info;


describe ('Info.js', () => {

    const mockTarget = {
        name: 'steve'
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
                {steve: {name: 'steve', version: ''}}
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
                'steve': {name: 'steve', version: ''}
            });
        });
    });
    describe('Info with data', () => {

        let info;

        beforeEach(() => {
            info = Info({name: 'bill', version: '1.0.1'});
        });

        it ('should add object as key when no objects exist for global yet', () => {
            getMetadataStub
                .onFirstCall().returns(undefined);

            info(mockTarget);

            sinon.assert.calledOnce(getMetadataStub);
            sinon.assert.calledWith(getMetadataStub, 'fabric:info', global);
            sinon.assert.calledOnce(defineMetadataStub);
            sinon.assert.calledWith(defineMetadataStub, 'fabric:info',
                {steve:  {name: 'bill', version: '1.0.1'}}
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
                'steve': {name: 'bill', version: '1.0.1'}
            });
        });
    });
});
