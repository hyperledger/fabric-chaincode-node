# Support and Compatibility

Github is used for code base management and [issue](https://github.com/hyperledger/fabric-chaincode-node/issues) tracking.

## Summary of Compatibility

This table shows the summary of the compatibility of the Node chaincode packages, together with the Node.js runtime they require.

| Node chaincode version | Minimum supported Node.js | Node.js runtime | Docker image platforms |
| ---------------------- | ------------------------- | --------------- | ---------------------- |
| v1.4                   | 8                         | 8               | amd64                  |
| v2.2                   | 12                        | 12              | amd64                  |
| v2.5.0 - v2.5.4        | 18                        | 18              | amd64, arm64           |
| v2.5.5 - v2.5.7        | 18                        | 20              | amd64, arm64           |
| v2.5.8+                | 18                        | 22              | amd64, arm64           |

The Node runtime provided by the chaincode Docker image determines the maximum Node version (and features) that smart contract code can exploit when using the default Node chaincode container.

Subject to a suitable runtime environment, the Node chaincode libraries can be used to communicate with Fabric peers at different LTS versions. The level of functionality is determined by the Fabric version in use and channel capabilities.

All Docker images, chaincode libraries and tools are tested using amd64 (x86-64) only.

## Chaincode builder

The default Fabric chaincode builder creates a Docker container to run deployed smart contracts. Node chaincode Docker containers are built using the `hyperledger/fabric-nodeenv` Docker image, tagged with the same major and minor version as the Fabric peer version. For example, Fabric v2.5 creates Node chaincode containers using the `hyperledger/fabric-nodeenv:2.5` Docker image. Fabric v3 continues to use the v2.5 Node chaincode image.

A different chaincode Docker image can be specified using the CORE_CHAINCODE_NODE_RUNTIME environment variable on the Fabric peer. For example, CORE_CHAINCODE_NODE_RUNTIME=example/customNodeRuntime:latest.

With Fabric v2 and later, an alternative chaincode builder can be configured on the Fabric peer. In this case the configured chaincode builder controls how chaincode is launched. See the [Fabric documentation](https://hyperledger-fabric.readthedocs.io/en/release-2.5/cc_launcher.html) for further details.

## Chaincode packaging

When using the `hyperledger/fabric-nodeenv` Node chaincode Docker images at v2 (and later), deployed chaincode is installed with npm as follows:

- If a `package-lock.json` or a `npm-shrinkwrap.json` file is present, `npm ci --only=production` will be used.
- Otherwise, `npm install --production` will be used.

When using the v1.4 `hyperledger/fabric-nodeenv` Node chaincode Docker images, deployed chaincode is installed with `npm install --production`.
