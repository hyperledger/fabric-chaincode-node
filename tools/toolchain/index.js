const {shell} = require('./shell/cmd');
const getTLSArgs = require('./utils').getTLSArgs;
module.exports.shell = shell;

module.exports.getTLSArgs = getTLSArgs;