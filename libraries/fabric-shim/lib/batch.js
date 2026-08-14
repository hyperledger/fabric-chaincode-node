/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

'use strict';

const {peer} = require('@hyperledger/fabric-protos');

const DATA_KEY_TYPE = 'data';
const METADATA_KEY_TYPE = 'metadata';

/**
 * Collects consecutive write operations so they can be sent to the peer
 * as one or more WRITE_BATCH_STATE messages.
 *
 * Same-key data writes (put/delete/purge) overwrite each other.
 * Metadata writes are tracked separately from data writes.
 */
class WriteBatch {
    constructor() {
        this.writes = new Map();
    }

    putState(collection, key, value) {
        this._writeData(this._record(key, value, collection, peer.WriteRecord.Type.PUT_STATE));
    }

    delState(collection, key) {
        this._writeData(this._record(key, undefined, collection, peer.WriteRecord.Type.DEL_STATE));
    }

    purgeState(collection, key) {
        this._writeData(this._record(key, undefined, collection, peer.WriteRecord.Type.PURGE_PRIVATE_DATA));
    }

    putStateMetadataEntry(collection, key, metakey, metadata) {
        const stateMetadata = new peer.StateMetadata();
        stateMetadata.setMetakey(metakey);
        stateMetadata.setValue(metadata);

        const rec = this._record(key, undefined, collection, peer.WriteRecord.Type.PUT_STATE_METADATA);
        rec.setMetadata(stateMetadata);
        this._writeMetadata(rec);
    }

    records() {
        return Array.from(this.writes.values());
    }

    _writeData(record) {
        this.writes.set(this._mapKey(DATA_KEY_TYPE, record), record);
    }

    _writeMetadata(record) {
        this.writes.set(this._mapKey(METADATA_KEY_TYPE, record), record);
    }

    _mapKey(type, record) {
        return `${type}:${record.getCollection()}:${record.getKey()}`;
    }

    _record(key, value, collection, type) {
        const rec = new peer.WriteRecord();
        rec.setKey(key);
        rec.setCollection(collection || '');
        rec.setType(type);
        if (value != null) {
            rec.setValue(value);
        }
        return rec;
    }
}

module.exports = WriteBatch;
