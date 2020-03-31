# Support and Compatibility for fabric-chaincode-node

Github is used for code base management, issues should reported in the [FABCN](https://jira.hyperledger.org/projects/FABCN/issues/) component in JIRA.


## Summary of Compatibility

This table shows the summary of the compatibility of the Node modules at versions 1.4 and 2.0, together with the Nodejs runtime they require and the Fabric Peer versions they can communicate with.

|                       | Peer Connectivity v1.4 | NodeJS | Peer Connectivity v2.0 |
| --------------------- | ---------------------- | ------ | ---------------------- |
| Node modules **v1.4** | Yes                    | 8      | Yes                    |
| Node modules **v2.0** | Yes                    | 10     | Yes                    |

By default a Fabric Peer v1.4 will create a Nodejs v8 runtime, and a Fabric Peer v2.0 will create a Nodejs v10 runtime. Whilst is the default, the docker image used to host the chaincode and contracts can be altered.  Set the environment variable `CORE_CHAINCODE_NODE_RUNTIME` on the peer to the name of the docker image. For example `CORE_CHAINCODE_NODE_RUNTIME=example/customNodeRuntime:latest`

The Node modules will connect to the peer whilst running; this is referred to as 'Fabric Peer Connectivity' in the table. For example, whilst the Fabric Peer v1.4 will create a Nodejs 8 runtime, if a Nodejs 12 runtime was configured, the Node modules at v2.0.0 still function when connecting to the Fabric Peer v1.4.

## Compatibility

The key elements are : 

- the version of the Fabric Contract Node modules used
- the version of the Nodejs runtime used to run the code
- When starting a chaincode container to run a Smart Contract the version of the runtime that is used is determined by these factors:

Fabric v1.4.2, and Fabric v2.0.0 will, by default, start up docker image to host the chaincode and contracts. The version of the docker image used is defined by the version of Fabric in use.

With Fabric v2.0.0, the chaincode container can be configured to be started by other means, and not the Peer. In this case, the environment used is not in the control of Fabric.

Node modules that are produced are `fabric-contract-api`, `fabric-shim`, `fabric-shim-crypto` & `fabric-shim-api`

### Supported Runtimes

v2.0.0 Node modules are supported running in Nodejs 10.15+, with the x86_64 architecture.

v1.4.x Node modules are supported running Nodejs 8.16.1 with the x86_64 architecture.

Architecture Support: all docker images, runtimes, tools are tested under x86_64 ONLY

### Default Peer Runtime selection

When using Fabric 2.0.0, the default docker image that is used to run the Node chaincode is node:10.15.2-alpine 

*Note:* With the default docker image used by Fabric 2.0.0 the packaged code will be installed with npm. If a `package-lock.json` or a `npm-shrinkwrap.json` file is present, `npm ci --only=production` will be used. Otherwise `npm install --production` will be used. 

When using Fabric 1.4.4, the docker image that is used to run the Node chaincode is node v8.16.1. It is installed with npm install --production

### Supported Runtime communication with the Peer

Subject to a suitable runtime environment, the 1.4.4 Node modules and 2.0.0 Node modules can used to communicate with a Fabric 2.0.0 or 1.4.4 Peer - with the level of functionality that is implied by the Fabric version in use. 