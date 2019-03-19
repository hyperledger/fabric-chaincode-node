/*
# Copyright Zhao Chaoyi. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

const ProtoLoader = require('../protoloader');
const path = require('path');

const _policiesProto = ProtoLoader.load({
    root: path.join(__dirname, '../protos'),
    file: 'common/policies.proto'
}).common;

const _principalProto = ProtoLoader.load({
    root: path.join(__dirname, '../protos'),
    file: 'msp/msp_principal.proto'
}).common;

const ROLE_TYPE_MEMBER = 'MEMBER';
const ROLE_TYPE_PEER = 'PEER';


/**
 * KeyEndorsementPolicy is used to help set endorsement policies and decode them
 * into validation parameter byte arrays, the shim provides convenience functions
 * that allow the chaincode developer to deal with endorsement policies in terms
 * of the MSP identifiers of organizations.
 * For more informations, please read the [documents]{@link https://hyperledger-fabric.readthedocs.io/en/latest/endorsement-policies.html#setting-key-level-endorsement-policies}
 *
 * @class
 */
class KeyEndorsementPolicy {
    /**
     * The construcotr accepts an optional argument `policy`.
     * The argument `policy` will be parsed if provided.
     * @param {Buffer} policy the endorsement policy retrieved for a key
     */
    constructor(policy) {
        this.orgs = {};
        if (policy) {
            const spe = _policiesProto.SignaturePolicyEnvelope.decode(policy);
            this._setMspIdsFromSPE(spe);
        }
    }

    /**
     * returns the endorsement policy as bytes
     * @returns {Buffer} the endorsement policy
     */
    getPolicy() {
        const spe = this._getPolicyFromMspId();
        return spe.toBuffer();
    }

    /**
     * adds the specified orgs to the list of orgs that are required
     * to endorse
     * @param {string} role the role of the new org(s). i.e., MEMBER or PEER
     * @param  {...string} neworgs the new org(s) to be added to the endorsement policy
     */
    addOrgs(role, ...neworgs) {
        let mspRole;
        switch (role) {
            case ROLE_TYPE_MEMBER:
                mspRole = _principalProto.MSPRole.MSPRoleType.MEMBER;
                break;
            case ROLE_TYPE_PEER:
                mspRole = _principalProto.MSPRole.MSPRoleType.PEER;
                break;
            default:
                throw new Error(`role type ${role} does not exist`);
        }

        neworgs.forEach(neworg => {
            this.orgs[neworg] = mspRole;
        });
    }

    /**
     * delete the specified channel orgs from the existing key-level endorsement
     * policy for this KVS key.
     * @param  {...string} delorgs the org(s) to be deleted
     */
    delOrgs(...delorgs) {
        delorgs.forEach(delorg => {
            delete this.orgs[delorg];
        });
    }

    /**
     * listOrgs returns an array of channel orgs that are required to endorse changes
     * @return {string[]} the list of channel orgs that are required to endorse changes
     */
    listOrgs() {
        return Object.keys(this.orgs);
    }

    /**
     * Internal used only, set the orgs map from a signature policy envelope
     * @param {_policiesProto.SignaturePolicyEnvelope} signaturePolicyEnvelope the signaturePolicyEnvelope
     *  decoded from the endorsement policy.
     */
    _setMspIdsFromSPE(signaturePolicyEnvelope) {
        // iterate over the identities in this envelope
        signaturePolicyEnvelope.identities.forEach(identity => {
            // this imlementation only supports the ROLE type
            /* istanbul ignore else */
            if (identity.PrincipalClassification === _principalProto.MSPPrincipal.ROLE) {
                const msprole = _principalProto.MSPRole.decode(identity.principal);
                this.orgs[msprole.msp_identifier] = msprole.role;
            }
        });
    }

    /**
     * Internal used only. construct the policy from all orgs' mspIds.
     * the policy requires exactly 1 signature from all of the principals.
     * @returns {_policiesProto.SignaturePolicyEnvelope} return the SignaturePolicyEnvelope instance
     */
    _getPolicyFromMspId() {
        const mspIds = this.listOrgs();
        const principals = [];
        const sigsPolicies = [];
        mspIds.forEach((mspId, i) => {
            const mspRole = new _principalProto.MSPRole();
            mspRole.setRole(this.orgs[mspId]);
            mspRole.setMspIdentifier(mspId);
            const principal = new _principalProto.MSPPrincipal();
            principal.setPrincipalClassification(_principalProto.MSPPrincipal.Classification.ROLE);
            principal.setPrincipal(mspRole.toBuffer());
            principals.push(principal);

            const signedBy = new _policiesProto.SignaturePolicy();
            signedBy.set('signed_by', i);
            sigsPolicies.push(signedBy);
        });

        // create the policy: it requires exactly 1 signature from all of the principals
        const allOf = new _policiesProto.SignaturePolicy.NOutOf();
        allOf.setN(mspIds.length);
        allOf.setRules(sigsPolicies);

        const noutof = new _policiesProto.SignaturePolicy();
        noutof.set('n_out_of', allOf);

        const spe = new _policiesProto.SignaturePolicyEnvelope();
        spe.setVersion(0);
        spe.setRule(noutof);
        spe.setIdentities(principals);
        return spe;
    }
}

module.exports = KeyEndorsementPolicy;
