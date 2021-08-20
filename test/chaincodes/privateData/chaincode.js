/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

class privateDataContract extends Contract {

    async assetExists(ctx, assetId) {
        const data = await ctx.stub.getPrivateDataHash("collection", assetId);
        return (!!data && data.length > 0);
    }

    async createAsset(ctx, assetId) {
        const exists = await this.assetExists(ctx, assetId);
        if (exists) {
            throw new Error(`The asset asset ${assetId} already exists`);
        }

        const privateAsset = {};

        const transientData = ctx.stub.getTransient();
        if (transientData.size === 0 || !transientData.has('privateValue')) {
            throw new Error('The privateValue key was not specified in transient data. Please try again.');
        }
        privateAsset.privateValue = transientData.get('privateValue').toString();

        await ctx.stub.putPrivateData("collection", assetId, Buffer.from(JSON.stringify(privateAsset)));
    }

    async readAsset(ctx, assetId) {
        const exists = await this.assetExists(ctx, assetId);
        if (!exists) {
            throw new Error(`The asset ${assetId} does not exist`);
        }
        let privateDataString;
        const privateData = await ctx.stub.getPrivateData("collection", assetId);
        privateDataString = JSON.parse(privateData.toString());
        return privateDataString;
    }

    async updateAsset(ctx, assetId) {
        const exists = await this.assetExists(ctx, assetId);
        if (!exists) {
            throw new Error(`The asset asset ${assetId} does not exist`);
        }
        const privateAsset = {};

        const transientData = ctx.stub.getTransient();
        if (transientData.size === 0 || !transientData.has('privateValue')) {
            throw new Error('The privateValue key was not specified in transient data. Please try again.');
        }
        privateAsset.privateValue = transientData.get('privateValue').toString();

        await ctx.stub.putPrivateData("collection", assetId, Buffer.from(JSON.stringify(privateAsset)));
    }

    async deleteAsset(ctx, assetId) {
        const exists = await this.assetExists(ctx, assetId);
        if (!exists) {
            throw new Error(`The asset asset ${assetId} does not exist`);
        }
        await ctx.stub.deletePrivateData("collection", assetId);
    }

    async verifyAsset(ctx, mspid, assetId, objectToVerify) {

        const hashToVerify = crypto.createHash('sha256').update(objectToVerify).digest('hex');
        const pdHashBytes = await ctx.stub.getPrivateDataHash("collection", assetId);
        if (pdHashBytes.length === 0) {
            throw new Error('No private data hash with the key: ' + assetId);
        }

        const actualHash = Buffer.from(pdHashBytes).toString('hex');

        if (hashToVerify === actualHash) {
            return true;
        } else {
            return false;
        }
    }
}

module.exports = privateDataContract;
