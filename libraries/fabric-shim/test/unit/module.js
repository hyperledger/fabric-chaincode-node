/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
/* global describe it */

'use strict';

const chai = require('chai');
const expect = chai.expect;

const theModule = require('../../../fabric-shim');

describe('Exports', () => {
    it ('should export the start function', () => {
        expect(typeof theModule.start).to.deep.equal('function');
    });

    it ('should export the success function', () => {
        expect(typeof theModule.success).to.deep.equal('function');
    });

    it ('should export the error function', () => {
        expect(typeof theModule.error).to.deep.equal('function');
    });

    it ('should export the Shim class', () => {
        expect(typeof theModule.Shim).to.deep.equal('function');
    });

    it ('should export the Stub class', () => {
        expect(typeof theModule.Stub).to.deep.equal('function');
    });

    it ('should export the ChaincodeInterface class', () => {
        expect(typeof theModule.ChaincodeInterface).to.deep.equal('function');
    });

    it ('should export the ClientIdentity class', () => {
        expect(typeof theModule.ClientIdentity).to.deep.equal('function');
    });

    it ('should export the Iterators.HistoryQueryIterator class', () => {
        expect(typeof theModule.Iterators.HistoryQueryIterator).to.deep.equal('function');
    });

    it ('should export the HistoryQueryIterator class', () => {
        expect(typeof theModule.HistoryQueryIterator).to.deep.equal('function');
    });

    it ('should export the Iterators.StateQueryIterator class', () => {
        expect(typeof theModule.Iterators.StateQueryIterator).to.deep.equal('function');
    });

    it ('should export the StateQueryIterator class', () => {
        expect(typeof theModule.StateQueryIterator).to.deep.equal('function');
    });
});
