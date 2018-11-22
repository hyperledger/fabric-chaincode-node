/*
# Copyright Zhao Chaoyi. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/


// const rewire = require('rewire');

const chai = require('chai');
const expect = chai.expect;
const KeyEndorsementPolicy = require('../../../lib/utils/statebased');

describe('KeyEndorsementPolicy', () => {
    describe('#constructor', () => {
        it('should success for no policy', () => {
            expect(() => new KeyEndorsementPolicy()).not.throw;
        });

        it('should decode policy', () => {
            const ep = new KeyEndorsementPolicy();
            ep.addOrgs('MEMBER', 'Org1MSP', 'Org2MSP');
            const policy = ep.getPolicy();
            const anotherEp = new KeyEndorsementPolicy(policy);
            expect(anotherEp.orgs).to.deep.eql({
                Org1MSP: 0,
                Org2MSP: 0
            });
        });
    });

    describe('#addOrgs', () => {
        let ep;

        beforeEach(() => {
            ep = new KeyEndorsementPolicy();
        });

        it('should throw error if role is not supported', () => {
            expect(() => ep.addOrgs('aDummyRole', 'org1msp')).to.throw(/role type aDummyRole does not exist/);
        });

        it('should throw error if role is missing', () => {
            expect(() => ep.addOrgs()).to.throw(/role type undefined does not exist/);
        });

        it('should success add multiple orgs', () => {
            ep.addOrgs('MEMBER', 'Org1MSP', 'Org2MSP');
            expect(ep).haveOwnProperty('orgs').not.empty;
            expect(ep.orgs).haveOwnProperty('Org1MSP').eqls(0);
            expect(ep.orgs).haveOwnProperty('Org2MSP').eqls(0);
            expect(Object.keys(ep.orgs).length).to.eql(2);
        });

        it('should success add one org', () => {
            ep.addOrgs('MEMBER', 'Org1MSP');
            expect(ep).haveOwnProperty('orgs').not.empty;
            expect(ep.orgs).haveOwnProperty('Org1MSP').eqls(0);
            expect(Object.keys(ep.orgs).length).to.eql(1);
        });

        it('should success add one peer org', () => {
            ep.addOrgs('PEER', 'Org1MSP');
            expect(ep).haveOwnProperty('orgs').not.empty;
            expect(ep.orgs).haveOwnProperty('Org1MSP').eqls(3);
            expect(Object.keys(ep.orgs).length).to.eql(1);
        });

        it('should not throw error if no orgs', () => {
            ep.addOrgs('MEMBER');
            expect(ep).haveOwnProperty('orgs').to.be.empty;
        });
    });

    describe('#_getPolicyFromMspId', () => {
        let ep;
        beforeEach(() => {
            ep = new KeyEndorsementPolicy();
            ep.addOrgs('MEMBER', 'Org1MSP', 'Org2MSP', 'Org3MSP');
        });

        it('should successfully get policy from mspIds', () => {
            const policy = ep._getPolicyFromMspId();
            expect(policy).haveOwnProperty('version').eqls(0);
            expect(policy).haveOwnProperty('identities').to.be.an('array');
            expect(policy.identities.length).to.eql(3);
            expect(policy.rule.toRaw()).to.deep.eqls({
                n_out_of: {
                    n: 3,
                    rules: [{
                        n_out_of: null,
                        signed_by: 0,
                        Type: 'signed_by'
                    }, {
                        n_out_of: null,
                        signed_by: 1,
                        Type: 'signed_by'
                    }, {
                        n_out_of: null,
                        signed_by: 2,
                        Type: 'signed_by'
                    }]
                },
                signed_by: 0,
                Type: 'n_out_of'
            });
        });
    });

    describe('#_setMspIdsFromSPE', () => {
        let spe;
        beforeEach(() => {
            const ep = new KeyEndorsementPolicy();
            ep.addOrgs('MEMBER', 'Org1MSP', 'Org2MSP', 'Org3MSP');
            ep.addOrgs('PEER', 'Org4MSP', 'Org5MSP');
            spe = ep._getPolicyFromMspId();
        });

        it('should successfully set mspIds from spe', () => {
            const ep = new KeyEndorsementPolicy();
            ep._setMspIdsFromSPE(spe);
            expect(ep.orgs).haveOwnProperty('Org1MSP').eqls(0);
            expect(ep.orgs).haveOwnProperty('Org2MSP').eqls(0);
            expect(ep.orgs).haveOwnProperty('Org3MSP').eqls(0);
            expect(ep.orgs).haveOwnProperty('Org4MSP').eqls(3);
            expect(ep.orgs).haveOwnProperty('Org5MSP').eqls(3);
        });
    });

    describe('#delOrgs', () => {
        let ep;

        beforeEach(() => {
            ep = new KeyEndorsementPolicy();
            ep.addOrgs('MEMBER', 'Org1MSP', 'Org2MSP', 'Org3MSP');
        });

        it('should successfully delete one org', () => {
            ep.delOrgs('Org1MSP');
            expect(ep.orgs).haveOwnProperty('Org2MSP').eqls(0);
            expect(ep.orgs).haveOwnProperty('Org3MSP').eqls(0);
            expect(ep.orgs).does.not.haveOwnProperty('Org1MSP');
        });

        it('should successfully delete multiple orgs', () => {
            ep.delOrgs('Org1MSP', 'Org3MSP');
            expect(ep.orgs).haveOwnProperty('Org2MSP').eqls(0);
            expect(ep.orgs).does.not.haveOwnProperty('Org1MSP');
            expect(ep.orgs).does.not.haveOwnProperty('Org3MSP');
        });
    });

    describe('#getPolicy', () => {
        let ep;

        beforeEach(() => {
            ep = new KeyEndorsementPolicy();
            ep.addOrgs('MEMBER', 'Org1MSP', 'Org2MSP', 'Org3MSP');
        });

        it('should successfully get policy', () => {
            const policy = ep.getPolicy();
            const anotherEp = new KeyEndorsementPolicy(policy);
            expect(anotherEp.orgs).to.haveOwnProperty('Org1MSP');
            expect(anotherEp.orgs).to.haveOwnProperty('Org2MSP');
            expect(anotherEp.orgs).to.haveOwnProperty('Org3MSP');
        });
    });
});
