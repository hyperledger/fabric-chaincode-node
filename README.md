# Hyperledger Fabric - Node.js Contracts

[![Build Status](https://dev.azure.com/Hyperledger/Fabric-Chaincode-Node/_apis/build/status/Fabric-Chaincode-Node?branchName=main)](https://dev.azure.com/Hyperledger/Fabric-Chaincode-Node/_build/latest?definitionId=33&branchName=main)
[![fabric-contract-api npm module](https://img.shields.io/npm/v/fabric-shim?label=fabric-contract-api)](https://www.npmjs.com/package/fabric-contract-api)
[![fabric-shim npm module](https://img.shields.io/npm/v/fabric-shim?label=fabric-shim)](https://www.npmjs.com/package/fabric-shim)
[![fabric-shim-api npm module](https://img.shields.io/npm/v/fabric-shim?label=fabric-shim-api)](https://www.npmjs.com/package/fabric-shim-api)
[![fabric-shim-crypto npm module](https://img.shields.io/npm/v/fabric-shim?label=fabric-shim-crypto)](https://www.npmjs.com/package/fabric-shim-crypto)
[![Rocket.Chat](https://chat.hyperledger.org/images/join-chat.svg)](https://chat.hyperledger.org/channel/fabric-chaincode-dev)

This is the project to support the writing of Contracts with the node.js runtime.

## Documentation

As an application developer, to learn about how to implement **"Smart Contracts"** for Hyperledger Fabric using Node.js, please visit the [API documentation](https://hyperledger.github.io/fabric-chaincode-node/) and follow the tutorial links.

- [API documentation](https://hyperledger.github.io/fabric-chaincode-node/)
- [Full Documenation on Hyperledger Fabric](https://hyperledger-fabric.readthedocs.io/)
- [Samples repository](https://github.com/hyperledger/fabric-samples)
- [Quick-start tutorial](TUTORIAL.md)

## Compatibility

For details on what Nodejs runtime and versions of Hyperledger Fabric can be used please see the [compatibility document](COMPATIBILITY.md).

## npm Shrinkwrap

In line with the advice from [npm on shrinkwrap](https://docs.npmjs.com/files/shrinkwrap.json#description) the modules published do not contain a `npm-shrinkwrap.json` file.

It is **STRONGLY** recommended therefore that after testing, and before putting your contract into production a `npm-shrinkwrap.json` file is created. When the chaincode is install it will be via a `npm install --production` command.

## Contributing

If you are interested in contributing updates to this project, please start with the [contributing guide](CONTRIBUTING.md).

There is also a [release guide](RELEASING.md) describing the process for publishing new versions.

---

## License <a name="license"></a>

Hyperledger Project source code files are made available under the Apache
License, Version 2.0 (Apache-2.0), located in the [LICENSE](LICENSE) file.
Hyperledger Project documentation files are made available under the Creative
Commons Attribution 4.0 International License (CC-BY-4.0), available at http://creativecommons.org/licenses/by/4.0/.
