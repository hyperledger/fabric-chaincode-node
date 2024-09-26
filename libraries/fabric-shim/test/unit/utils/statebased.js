/*
# Copyright Zhao Chaoyi. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

const { msp, common } = require('@hyperledger/fabric-protos');
const { SignedProposal } = require('@hyperledger/fabric-protos/lib/peer');
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
                Org2MSP: 0,
            });
        });
    });

    describe('#addOrgs', () => {
        let ep;

        beforeEach(() => {
            ep = new KeyEndorsementPolicy();
        });

        it('should throw error if role is not supported', () => {
            expect(() => ep.addOrgs('aDummyRole', 'org1msp')).to.throw(
                /role type aDummyRole does not exist/
            );
        });

        it('should throw error if role is missing', () => {
            expect(() => ep.addOrgs()).to.throw(
                /role type undefined does not exist/
            );
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

            const spe =
                common.SignaturePolicyEnvelope.deserializeBinary(policy);
            const speClone = common.SignaturePolicyEnvelope.deserializeBinary(
                anotherEp.getPolicy()
            );
            expect(spe.toObject()).to.deep.equals(speClone.toObject());
        });

        it('should get policy that is semantically valid', () => {
            const policy = ep.getPolicy();
            const spe =
                common.SignaturePolicyEnvelope.deserializeBinary(policy);

            // create a blank object and expand all the protobufs into it
            const speObject = spe.toObject();

            speObject.identitiesList = spe
                .getIdentitiesList()
                .map((principal) => {
                    let mapped = { principalClassification: 0 };
                    mapped.principal = msp.MSPRole.deserializeBinary(
                        principal.getPrincipal_asU8()
                    ).toObject();
                    return mapped;
                });

            speObject.rule.signedBy = spe.getRule().getSignedBy();
            speObject.rule.nOutOf.rulesList = spe
                .getRule()
                .getNOutOf()
                .getRulesList()
                .map((sigRule) => {
                    return { signedBy: sigRule.getSignedBy() };
                });

            const expectedPolicy = {
                version: 0,
                rule: {
                    signedBy: 0,
                    nOutOf: {
                        n: 3,
                        rulesList: [
                            { signedBy: 0 },
                            { signedBy: 1 },
                            { signedBy: 2 },
                        ],
                    },
                },
                identitiesList: [
                    {
                        principalClassification: 0,
                        principal: { mspIdentifier: 'Org1MSP', role: 0 },
                    },
                    {
                        principalClassification: 0,
                        principal: { mspIdentifier: 'Org2MSP', role: 0 },
                    },
                    {
                        principalClassification: 0,
                        principal: { mspIdentifier: 'Org3MSP', role: 0 },
                    },
                ],
            };
            expect(speObject).to.deep.equals(expectedPolicy);
        });
    });
});
