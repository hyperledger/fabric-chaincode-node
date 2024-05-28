# Support and Compatibility for fabric-chaincode-node

Github is used for code base management, issues should reported in the repository's [GitHub Issues](https://github.com/hyperledger/fabric-chaincode-node/issues).

## Summary of Compatibility

This table shows the summary of the compatibility of the Node modules at versions 1.4 and 2.x, together with the Node.js runtime they require and the Fabric Peer versions they can communicate with.

| Chaincode Docker image | Peer connectivity v1.4 | Peer connectivity v2.x | Minimum supported Node.js | Node.js runtime |
| --- | --- | --- | --- | --- |
| **v1.4.5** | Yes | Yes | 8 | 8 |
| **v2.2.x** | Yes | Yes | 12 | 12 |
| **v2.3.x** | Yes | Yes | 12 | 12 |
| **v2.4.x** | Yes | Yes | 16 | 16 |
| **v2.5.0** - **v2.5.4** | Yes | Yes | 18 | 18 |
| **v2.5.5+** | Yes | Yes | 18 | 20 |

Whilst these are defaults based on the corresponding `fabric-nodeenv` Docker image version, the Docker image used to host the chaincode and contracts can be altered. Set the environment variable `CORE_CHAINCODE_NODE_RUNTIME` on the peer to the name of the desired Docker image and version.

For example `CORE_CHAINCODE_NODE_RUNTIME=hyperledger/fabric-nodeenv:2.2` will allow the use of a Node 12 runtime to be used within a Peer v1.4.

The Node chaincode modules will connect to the peer whilst running; this is referred to as 'Fabric Peer Connectivity' in the table. For example, whilst the Fabric Peer v1.4 will create a Node.js 8 runtime, if a Node.js 12 runtime was configured, the node chaincode modules at v2.x still function when connecting to the Fabric Peer v1.4.

### Version 1.4 compatibility with later Node.js runtimes

Note that the `fabric-contract-api` & `fabric-shim` node modules must be at v1.4.5 or greater to work with Node.js version 12. If you therefore use a contract originally written to work with Fabric 1.4, check the node modules before deploying on Fabric v2.

Also please note that that the v1.4 libraries WILL NOT work with Node.js 16 or Node.js 18. Unless you configure a different node environment, any chaincode using the v1.4 node chaincode libraries will need to update to the v2.5 node chaincode libraries before being able to run with a Fabric v2.5 Peer.

## Compatibility

The key elements are :

- the version of the Fabric Contract Node modules used
- the version of the Node.js runtime used to run the code
- When starting a chaincode container to run a Smart Contract, the version of the runtime that is used is determined by these factors:

Fabric v1.4.x, and Fabric v2.x will, by default, start up a Docker container based on `fabric-nodeenv` to host the chaincode and contracts. The version of the Docker image used is driven by the version of Fabric in use, but can be overridden by setting the peer's `CORE_CHAINCODE_NODE_RUNTIME` environment variable.

With Fabric v2.x, the chaincode container can be configured to be started by other means, and not the Peer. In this case, the environment used is not in the control of Fabric.

Node modules that are produced are `fabric-contract-api`, `fabric-shim` & `fabric-shim-api`

### Supported Runtimes

* Fabric v1.4 Node.js chaincode modules are supported running Nodejs 8.16.1 with the x86_64 architecture.
* Fabric v2.2/v2.3 Node.js chaincode modules are supported running in Node.js 12.22.6, with the x86_64 architecture.
* Fabric v2.4 Node.js chaincode modules are supported running in Node.js 16.x, with the x86_64 architecture.
* Fabric v2.5.x Node.js chaincode modules are supported running in Node.js 18.x, with the x86_64 and arm64 architectures.

Architecture Support: all Docker images, runtimes, tools are tested under x86_64 ONLY

### Default Peer Runtime selection

* Fabric 2.2/2.3 `fabric-nodeenv` Docker image is based on node:12.22.6-alpine.
* Fabric 2.4 `fabric-nodeenv` Docker image is based on node:16-alpine.
* Fabric 2.5.0 - 2.5.4 `fabric-nodeenv` Docker image is based on node:18-alpine.
* Fabric 2.5.5+ `fabric-nodeenv` Docker image is based on node:20-alpine.

*Note:* With the default Docker image used by Fabric 2.x, the packaged code will be installed with npm. If a `package-lock.json` or a `npm-shrinkwrap.json` file is present, `npm ci --only=production` will be used. Otherwise `npm install --production` will be used. 

When using Fabric 1.4.x, the Docker image that is used to run the Node.js chaincode is node v8.16.1. It is installed with npm install --production

### Supported Runtime communication with the Peer

Subject to a suitable runtime environment, the 1.4.x Node.js chaincode modules and 2.x Node.js chaincode modules can be used to communicate with a Fabric 2.x or 1.4.x Peer - with the level of functionality that is implied by the Fabric version in use. 
