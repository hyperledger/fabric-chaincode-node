[![NPM](https://nodei.co/npm/fabric-contract-api.svg?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/fabric-contract-api/)
[![NPM](https://nodei.co/npm/fabric-shim.svg?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/fabric-shim/)


[![Version](https://badge.fury.io/js/fabric-shim.svg)](http://badge.fury.io/js/fabric-shim)

The `fabric-contract-api` provides the *contract interface*  a high level API for application developers to implement [Smart Contracts](https://hyperledger-fabric.readthedocs.io/en/release-2.1/glossary.html#smart-contract). Working with this API provides a high level entry point to writing business logic.

Within Hyperledger Fabric, Smart Contracts can also be referred to as [Chaincode](https://hyperledger-fabric.readthedocs.io/en/release-2.1/glossary.html#chaincode).  To be more specific, the term chaincode is preferred to be used to refer to the overall container that is hosting the contracts.

The `fabric-shim` provides the *chaincode interface*, a lower level API for implementing "Smart Contracts". It also _currently_ provides the implementation to support communication with Hyperledger Fabric peers for Smart Contracts written using the `fabric-contract-api`.  To confirm that this is the same as the `fabric-shim` in previous versions of Hyperledger Fabric.

Detailed explanation on the concept and programming model can be found here: [https://hyperledger-fabric.readthedocs.io/en/latest/smartcontract/smartcontract.html](https://hyperledger-fabric.readthedocs.io/en/latest/smartcontract/smartcontract.html).

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
module.exports.contracts = [UpdateValues];
```

**Note:** In order to make this contract 'runnable' you must also install the `fabric-shim` module as below, and ensure that the 'start' script in `package.json` refers to `fabric-chaincode-node start`

```json
  "scripts": {
   	"start": "fabric-chaincode-node start"
  }
```

The `fabric-shim` provides the `fabric-chaincode-node` commands; this can also be used to create a skelton metadata file. 

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

### API Reference
Visit [API Reference](https://hyperledger.github.io/fabric-chaincode-node/main/api/) and click on "Classes" link in the navigation bar on the top to view the list of class APIs.



## Support
Tested with Node v12  LTS release.

## License

This package is distributed under the
[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0),
see LICENSE.txt for more information.
