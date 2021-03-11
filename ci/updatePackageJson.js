const fs = require('fs');
let filename = process.argv[2];
let input = JSON.parse(fs.readFileSync(filename));
let ver = process.env.RELEASE_VERSION;

// don't want to update the main package.json version for the 'fake' test contracts
// only the dependencies
if (!filename.match(/\/test\//g)){
    input.version = ver;
}

if (input.dependencies) {
    if (input.dependencies['fabric-contract-api']) input.dependencies['fabric-contract-api'] = ver;
    if (input.dependencies['fabric-ledger']) input.dependencies['fabric-ledger'] = ver;
    if (input.dependencies['fabric-shim']) input.dependencies['fabric-shim'] = ver;
    if (input.dependencies['fabric-shim-api']) input.dependencies['fabric-shim-api'] = ver;
    if (input.dependencies['fabric-shim-crypto']) input.dependencies['fabric-shim-crypto'] = ver;
}
fs.writeFileSync(filename, JSON.stringify(input, null, 2));