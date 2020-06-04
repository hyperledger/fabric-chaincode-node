const {shell} = require('./shell/cmd');
const {getTLSArgs, getPeerAddresses} = require('./utils');

module.exports.shell = shell;

module.exports.getTLSArgs = getTLSArgs;
module.exports.getPeerAddresses = getPeerAddresses;
