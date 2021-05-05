/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

module.exports.generateLoggingPrefix = (channelId, txId) => {
    return `[${channelId}-${shortTxID(txId)}]`;
};

function shortTxID (txId) {
    return txId.substring(0, 8);
}
