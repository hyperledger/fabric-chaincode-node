/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

import { Contract, Context, Transaction, Returns, Object, Property } from 'fabric-contract-api';

@Object()
class SomethingThatCouldBeAProperty {
    @Property()
    public id: string;

    @Property()
    public value: number;

    constructor(id: string, value: number) {
        this.id = id;
        this.value = value;
    }

    serialize(): string {
        return JSON.stringify({
            id: this.id,
            value: this.value
        });
    }

    static deserialize(stringifed: string): SomethingThatCouldBeAProperty {
        const json = JSON.parse(stringifed);

        if (!json.hasOwnProperty('id') || !json.hasOwnProperty('value')) {
            throw new Error('Was not JSON formatted asset');
        }

        return new SomethingThatCouldBeAProperty(json.id, json.value);
    }
}

@Object()
class Asset {
    static stateIdentifier: string = 'asset';

    @Property()
    public id: string;

    @Property()
    public name: string;

    @Property()
    public value: number;

    @Property()
    public extra: SomethingThatCouldBeAProperty;

    constructor(id: string, name: string, value: number, extra: SomethingThatCouldBeAProperty) {
        this.id = id;
        this.name = name;
        this.value = value;
        this.extra = extra;
    }

    serialize(): string {
        return JSON.stringify({
            id: this.id,
            name: this.name,
            value: this.value,
            extra: this.extra.serialize()
        });
    }

    static deserialize(stringifed: string): Asset {
        const json = JSON.parse(stringifed);

        if (!json.hasOwnProperty('id') || !json.hasOwnProperty('name') || !json.hasOwnProperty('value')) {
            throw new Error('Was not JSON formatted asset');
        }

        return new Asset(json.id, json.name, json.value, SomethingThatCouldBeAProperty.deserialize(json.extra));
    }
}

@Object()
class Person {
    @Property()
    private eyeColour: string;
}

@Object()
class Bob extends Person {
    @Property()
    private houseName: string;

}

@Object()
class Fred extends Person {
    @Property()
    private favouriteColour: string;
}

export default class TestContract extends Contract {
    constructor() {
        super()
    }

    @Transaction()
    public async createAsset(ctx: Context, id: string, name: string, value: number, extraID: string, extraValue: number) {
        const asset = new Asset(id, name, value, new SomethingThatCouldBeAProperty(extraID, extraValue));

        await ctx.stub.putState(ctx.stub.createCompositeKey(Asset.stateIdentifier, [asset.id]), Buffer.from(asset.serialize()))
    }

    @Transaction()
    public async updateAsset(ctx: Context, asset: Asset) {
        const existingAsset = await this.getAsset(ctx, asset.id);

        existingAsset.value = asset.value;
        existingAsset.extra.value = asset.extra.value;

        await ctx.stub.putState(ctx.stub.createCompositeKey(Asset.stateIdentifier, [asset.id]), Buffer.from(existingAsset.serialize()))
    }

    @Transaction(false)
    @Returns("Asset")
    public async getAsset(ctx: Context, id: string): Promise<Asset> {
        const json = await ctx.stub.getState(ctx.stub.createCompositeKey(Asset.stateIdentifier, [id]))

        return Asset.deserialize(json.toString());
    }

    public async ignoreMe(ctx: Context, id: string) {
        // DO NOTHING
    }
    
}