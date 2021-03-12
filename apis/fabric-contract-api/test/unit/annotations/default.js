/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
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
