[![Build Status](https://dev.azure.com/Hyperledger/Fabric-Chaincode-Node/_apis/build/status/Fabric-Chaincode-Node?branchName=main)](https://dev.azure.com/Hyperledger/Fabric-Chaincode-Node/_build/latest?definitionId=33&branchName=main)
[![fabric-contract-api npm module](https://img.shields.io/npm/v/fabric-shim?label=fabric-contract-api)](https://www.npmjs.com/package/fabric-contract-api)
[![fabric-shim npm module](https://img.shields.io/npm/v/fabric-shim?label=fabric-shim)](https://www.npmjs.com/package/fabric-shim)
[![fabric-shim-api npm module](https://img.shields.io/npm/v/fabric-shim?label=fabric-shim-api)](https://www.npmjs.com/package/fabric-shim-api)
[![Rocket.Chat](https://chat.hyperledger.org/images/join-chat.svg)](https://chat.hyperledger.org/channel/fabric-chaincode-dev)

## Overview

The `fabric-contract-api` provides the *contract interface*. a high level API for application developers to implement [Smart Contracts](https://hyperledger-fabric.readthedocs.io/en/latest/glossary.html#smart-contract). Within Hyperledger Fabric, Smart Contracts are also known as [Chaincode](https://hyperledger-fabric.readthedocs.io/en/latest/glossary.html#chaincode). Working with this API provides a high level entry point to writing business logic.

The `fabric-shim` provides the *chaincode interface*, a lower level API for implementing "Smart Contracts". It also provides the implementation to support communication with Hyperledger Fabric peers for Smart Contracts written using the `fabric-contract-api` together with the `fabric-chaincode-node` cli to launch Chaincode or Smart Contracts.

To confirm that the `fabric-shim` maintains API and functional compatibility with previous versions of Hyperledger Fabric.

A more detailed explanation on the concept and programming model can be found in the [smart contract processing topic](https://hyperledger-fabric.readthedocs.io/en/release-2.3/developapps/smartcontract.html).

## Contract Interface

### Installation

```sh
npm install --save fabric-contract-api
```

### Usage

Implement a class that ends the `contract` class, a constructor is needed.
The other functions will be invokable functions of your Smart Contract

```javascript
// updatevalues.js
'use strict';

// SDK Library to asset with writing the logic
const { Contract } = require('fabric-contract-api');

// Business logic (well just util but still it's general purpose logic)
const util = require('util');

/**
 * Support the Updating of values within the SmartContract
 */
class UpdateValuesContract extends Contract

    constructor(){
		super('UpdateValuesContract');
	}

	async transactionA(ctx, newValue) {
		// retrieve existing chaincode states
		let oldValue = await ctx.stub.getState(key);

		await ctx.stub.putState(key, Buffer.from(newValue));

		return Buffer.from(newValue.toString());
	}

	async transactionB(ctx) {
	  //  .....
	}

};

module.exports = UpdateValuesContract
```

As with standard node modules make sure that this class is exported as follows.
```javascript
// index.js
'use strict';

const UpdateValues = require('./updatevalues')
module.exports.contracts = ['UpdateValues'];
```

**Note:** In order to make this contract runnable in version 1.4, also install the `fabric-shim` module as below, and ensure that the 'start' script in `package.json` refers to `fabric-chaincode-node`

```json
  "scripts": {
	"start": "fabric-chaincode-node start"
  }
```

## Chaincode Interface

### Installation

```sh
npm install --save fabric-shim
```

### Usage
The [chaincode interface](https://hyperledger.github.io/fabric-chaincode-node/main/api/fabric-shim.ChaincodeInterface.html) contains two methods to be implemented:
```javascript
const shim = require('fabric-shim');

const Chaincode = class {
	async Init(stub) {
		// use the instantiate input arguments to decide initial chaincode state values

		// save the initial states
		await stub.putState(key, Buffer.from(aStringValue));

		return shim.success(Buffer.from('Initialized Successfully!'));
	}

	async Invoke(stub) {
		// use the invoke input arguments to decide intended changes

		// retrieve existing chaincode states
		let oldValue = await stub.getState(key);

		// calculate new state values and saves them
		let newValue = oldValue + delta;
		await stub.putState(key, Buffer.from(newValue));

		return shim.success(Buffer.from(newValue.toString()));
	}
};
```

Start the chaincode process and listen for incoming endorsement requests:
```javascript
shim.start(new Chaincode());
```

## Run chaincode as a external service
To run chaincode as an external service, fabric-shim provides the `shim.server` API. If you are using contract APIs, you may want to use the `server` command provided by `fabric-chaincode-node` CLI to run a contract in the external service mode. To run a chaincode with the `fabric-contract` API as an external service, simply use `fabric-chaincode-node server` instead of `fabric-chaincode-node start`. Here is a sample for `package.json`:
```javascript
{
        "scripts": {
                "start": "fabric-chaincode-node server"
        },
        ...
}
```

When `fabric-chaincode-node server` is used, the following options should be set as either arguments or environment variables:
* **CORE_CHAINCODE_ID (--chaincode-id)**
* **CORE_CHAINCODE_ADDRESS (--chaincode-address)**

If TLS is enabled, the following additional options are required:
* **CORE_CHAINCODE_TLS_CERT_FILE (--chaincode-tls-cert-file)**: path to a certificate
* **CORE_CHAINCODE_TLS_KEY_FILE (--chaincode-tls-key-file)**: path to a private key

When mutual TLS is enabled, **CORE_CHAINCODE_TLS_CLIENT_CACERT_FILE (--chaincode-tls-client-cacert-file)** option should be set to specify the path to the CA certificate for acceptable client certific

There are other optional arguments can be set to pass gRPC options which will be used to override the default values. Here is a sample for `package.json`:

```javascript
{
       "scripts": {
                "start": "fabric-chaincode-node server --chaincode-address=localhost:7100 --chaincode-id=<ccid> --grpc.max_send_message_length 100000000 --grpc.max_receive_message_length 100000000"
        },
        ...
}
```
This would increase the grpc limit from the default of 4MB to 100MB. This gRPC parameter override option has been added in node chaincode v2.5.4.

The valid options are as listed below:
```
      --chaincode-address  [string] [required]
	  --chaincode-id  [string] [required]
      --grpc.max_send_message_length  [number] [default: -1]
      --grpc.max_receive_message_length  [number] [default: -1]
      --grpc.keepalive_time_ms  [number] [default: 110000]
      --grpc.http2.min_time_between_pings_ms  [number] [default: 110000]
      --grpc.keepalive_timeout_ms  [number] [default: 20000]
      --grpc.http2.max_pings_without_data  [number] [default: 0]
      --grpc.keepalive_permit_without_calls  [number] [default: 1]
      --chaincode-tls-cert-file  [string]
      --chaincode-tls-cert-path  [string]
      --chaincode-tls-key-file  [string]
      --chaincode-tls-key-path  [string]
      --chaincode-tls-client-cacert-file  [string]
      --chaincode-tls-client-cacert-path  [string]
      --module-path  [string]
```

## Support
Tested with node.js 8.9.0 (LTS).

## License

This package is distributed under the
[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0),
see LICENSE.txt for more information.
