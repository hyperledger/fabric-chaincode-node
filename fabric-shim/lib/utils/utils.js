module.exports.generateLoggingPrefix = (channelId, txId) => {
    return `[${channelId}-${shortTxID(txId)}]`;
};

function shortTxID (txId) {
    return txId.substring(0, 8);
}