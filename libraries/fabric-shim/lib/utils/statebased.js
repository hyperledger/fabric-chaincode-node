/*
# Copyright Zhao Chaoyi. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

const fabprotos = require('../../bundle');

const ROLE_TYPE_MEMBER = 'MEMBER';
const ROLE_TYPE_PEER = 'PEER';


/**
 * KeyEndorsementPolicy is used to help set endorsement policies and decode them
 * into validation parameter byte arrays, the shim provides convenience functions
 * that allow the chaincode developer to deal with endorsement policies in terms
 * of the MSP identifiers of organizations.
 * For more informations, please read the [documents]{@link https://hyperledger-fabric.readthedocs.io/en/release-2.1/endorsement-policies.html#setting-key-level-endorsement-policies}
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
            const spe = fabprotos.common.SignaturePolicyEnvelope.decode(policy);
            this._setMspIdsFromSPE(spe);
        }
    }

    /**
     * returns the endorsement policy as bytes
     * @returns {Buffer} the endorsement policy
     */
    getPolicy() {
        const spe = this._getPolicyFromMspId();
        return fabprotos.common.SignaturePolicyEnvelope.encode(spe).finish();
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
                mspRole = fabprotos.common.MSPRole.MSPRoleType.MEMBER;
                break;
            case ROLE_TYPE_PEER:
                mspRole = fabprotos.common.MSPRole.MSPRoleType.PEER;
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
            if (identity.principalClassification === fabprotos.common.MSPPrincipal.Classification.ROLE) {
                const msprole = fabprotos.common.MSPRole.decode(identity.principal);
                this.orgs[msprole.mspIdentifier] = msprole.role;
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
            const mspRole = {
                role: this.orgs[mspId],
                mspIdentifier: mspId
            };
            const principal = {
                principalClassification: fabprotos.common.MSPPrincipal.Classification.ROLE,
                principal: fabprotos.common.MSPRole.encode(mspRole).finish()
            };
            principals.push(principal);

            const signedBy = {
                signedBy: i,
            };
            sigsPolicies.push(signedBy);
        });

        // create the policy: it requires exactly 1 signature from all of the principals
        const allOf = {
            n: mspIds.length,
            rules: sigsPolicies
        };

        const noutof = {
            nOutOf: allOf
        };

        const spe = {
            version: 0,
            rule: noutof,
            identities: principals
        };
        return spe;
    }
}

module.exports = KeyEndorsementPolicy;
