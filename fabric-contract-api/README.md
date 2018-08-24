[![NPM](https://nodei.co/npm/fabric-contract-api.svg?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/fabric-contract-api/)



[![Version](https://badge.fury.io/js/fabric-shim.svg)](http://badge.fury.io/js/fabric-shim) [![Build Status](https://jenkins.hyperledger.org/buildStatus/icon?job=fabric-chaincode-node-merge-x86_64)](https://jenkins.hyperledger.org/view/fabric-chaincode-node/job/fabric-chaincode-node-merge-x86_64)

The `fabric-contract-api` provides the *contract interface*. a high level API for application developers to implement [Smart Contracts](https://hyperledger-fabric.readthedocs.io/en/latest/glossary.html#smart-contract). Within Hyperledger Fabric, Smart Contracts are also known as [Chaincode](https://hyperledger-fabric.readthedocs.io/en/latest/glossary.html#chaincode). Working with this API provides a high level entry point to writing business logic.
(this contract interface is new in version 1.3)


Detailed explanation on the concept and programming model can be found here: [http://hyperledger-fabric.readthedocs.io/en/latest/chaincode.html](http://hyperledger-fabric.readthedocs.io/en/latest/chaincode.html).


## Contract Interface

### Installation

```sh
npm install --save fabric-contract-api
```

### Usage

Implement a class that ends the `contract` class, a contsturctor is needed. 
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
		super('org.mynamespace.updates');
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

**Note:** In order to make this contract runnable in version 1.3, also install the `fabric-shim` module as below, and ensure that the 'start' script in `package.json` refers to `startChaincode`

```json
  "scripts": {
	"start": "startChaincode"
  }
```

### API Reference
Visit [fabric-shim.github.io](https://fabric-shim.github.io/) and click on "Classes" link in the navigation bar on the top to view the list of class APIs.



## Support
Tested with node.js 8.9.0 (LTS).

## License

This package is distributed under the
[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0),
see LICENSE.txt for more information.