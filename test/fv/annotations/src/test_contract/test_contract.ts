import { Contract, Context, Transaction, Returns, Object, Property } from 'fabric-contract-api';

@Object()
class Asset {
    static stateIdentifier: string = 'asset';

    @Property()
    public id: string;

    @Property()
    public name: string;

    @Property()
    public value: number;

    constructor(id: string, name: string, value: number) {
        this.id = id;
        this.name = name;
        this.value = value;
    }

    serialize():string {
        return JSON.stringify({
            id: this.id,
            name: this.name,
            value: this.value
        });
    }

    static deserialize(stringifed: string):Asset {
        const json = JSON.parse(stringifed);

        if (!json.hasOwnProperty('id') || !json.hasOwnProperty('name')) {
            throw new Error('Was not JSON formatted asset');
        }

        return new Asset(json.id, json.name, json.value);
    }
}

export default class TestContract extends Contract {
    constructor() {
        super()
    }

    @Transaction()
    public async createAsset(ctx: Context, id: string, name: string, value: number) {
        const asset = new Asset(id, name, value);

        await ctx.stub.putState(ctx.stub.createCompositeKey(Asset.stateIdentifier, [asset.id]), Buffer.from(asset.serialize()))
    }

    @Transaction()
    @Returns("string")
    public async getAsset(ctx: Context, id: string) {

        const json = await ctx.stub.getState(ctx.stub.createCompositeKey(Asset.stateIdentifier, [id]))

        Asset.deserialize(json.toString());

        return json.toString();
    }

    public async ignoreMe(ctx: Context, id: string) {
        // DO NOTHING
    }
}