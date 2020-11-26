

This outlines the theory of the how the new node module works; with the fabric samples project you will find scenario-based approaches.

## Writing the chaincode

### 1: Chaincode is created as an npm module.

An initial `package.json` is as follows;

The dependencies of `fabric-contract-api` and `fabric-shim` will be required.

```
{
  "name": "chaincode",
  "description": "My first exciting chaincode implemented in node.js",
  "engines": {
    "node": "^12.16.1",
    "npm": "^6.4.1"
  },
  "scripts": {
	  "test":"mocha.....
  },
  "engine-strict": true,
  "engineStrict": true,
  "version": "1.0.0",
  "main": "index.js",
  "author": "",
  "license": "Apache-2.0",
  "dependencies": {
    "fabric-contract-api": "^2.3.1-unstable",
    "fabric-shim": "^2.3.1-unstable"
  }
}

```
Remember to add in any additional business logic, and testing libraries needed

Adding `fabric-shim` as a dependency, gives a command `fabric-chaincode-node` that is the script to run for `npm start`.

```
  "scripts": {
    "start": "fabric-chaincode-node start",
    "test": "nyc mocha test",
    ....
  },
```


### 2: How is chaincode deployed?

Chaincode is deployed by the peer in response to issuing a number of (usually CLI) commands. For node.js chaincode the location of the chaincode npm project is required (the directory that the package.json is in). This does not need to be an installed project, but has to have all the code, and the package.json.

A docker image is built for this chaincode, the package.json and code copied in. and `npm install` run.

After the install there is a 'bootstrap' process that starts the chaincode up (more details later). The constructors of the exported Contracts will be run at this point; these constructors are for setting the name and optional setup of the 'error/monitoring functions', (again more later). This instance of the contract will existing whilst this chaincode docker image is up.

When chaincode is instantiated or updated, the `init()` function is the chaincode is called. As with the `invoke()` call from the client, a fn name and parameters can be passed. Remember therefore to have specific functions to call on `init()` and `update()` in order to do any data initialisation or migration that might be needed.  These two functions have been abstracted away to focus on specific function implementations.

It is strongly recommended to use the npm shrinkwrap mechanism so the versions of the modules that are used are fixed.

Within the class you can defined as many or functions as you wish. These transaction functions will form the basis of the business logic you contract needs to execute. These are `async` functions, and can take parameters and return values. There is a single mandatory parameter of the 'transaction context'; this represents the currently executing transaction and is the way functions can access the world state, and other APIs.

### 3: What needs to be exported?

Node states that module exports are defined in `index.js`

In this example we have a single value that can be queried and updated. This has been split into to parts for demonstration purposes.

```
// index.js
'use strict';

const UpdateValues = require('./updatevalues')
const RemoveValues = require('./removevalues')

module.exports.contracts = [UpdateValues,RemoveValues];
```

This exports two classes that together form the Contract. There can be other code that within the model that is used in a support role.
*Note that the 'contracts' word is mandatory.*

### 4: What do these classes need to contain?

As an example the `updatevalues` will look like this (with the function bodies remove for clarity)

```
// updatevalues.js
'use strict';

// SDK Library to asset with writing the logic
const { Contract } = require('fabric-contract-api');

// Business logic (well just util but still it's general purpose logic)
const util = require('util');

/**
 * Support the Updating of values within the SmartContract
 */
class UpdateValues extends Contract

    constructor(){
		super('UpdateValuesContract');
	}

	async instantiate(ctx){
	  //  .....
	}

	async setNewAssetValue(ctx, newValue) {
	  //  .....
	}

	async doubleAssetValue(ctx) {
	  //  .....
	}

};

module.exports = UpdateValues;
```

Note that ALL the functions defined in these modules will be called by the client SDK.

- There are 3 functions `setup` `setNewAssetValue` and `doubleAssetValue` that can be called by issuing the appropriate invoke client side
- The `ctx` in the function is a transaction context; each time a invoke is called this will be a new instance that can be used by the function implementation to access apis such as the world state of information on invoking identity.
- The arguments are split out from the array passed on the invoke.
- The constructor contains a 'name' to help identify the sets of functions

## Running chaincode in development mode

This is quite easy - as you need to run the startChaincode command.

```
$ $(npm bin)/fabric-chaincode-node start --peer.address localhost:7052 --chaincode-id-name "mycontract:v0"
```

(this is actually what the peer does; this does mean that any chaincode that is written using the existing chaincode interface will continue to work as is.)

## Using this chaincode

Each of the functions can be invoked with arbitrary arguments. The name of the function is of the format

```
[name:]functionname
```

If a name is given in the constructor then it will be prefixed separated by a : (colon)

> _assuming that you have a fabric up and running with the appropriate environment variables set_

```
$ peer chaincode install --lang node --name mycontract --version v0 --path ~/chaincode-examples
$ peer chaincode instantiate --orderer localhost:7050 --channelID mychannel --lang node --name mycontract --version v0 -c '{"Args":["UpdateValuesContract:setup"]}'
```

Will get things working...
Then you can invoke the chaincode via this command.

```
$ peer chaincode invoke --orderer localhost:7050 --channelID mychannel -c '{"Args":["UpdateValuesContract:getAssetValue"]}' -n mycontract4
```


## Additional support provided by the SmartContract class

In the case where you ask for a function to be executed, it could be the case that this doesn't exist.
You can provide you own function to be executed in this case, the default is to throw and error but you're able to customise this if you wish.

For example


```
	/**
	 * Sets a name so that the functions in this particular class can
	 * be separated from others.
	 */
	constructor() {
		super('UpdateValuesContract');
	}

	/** The function to invoke if something unkown comes in.
	 *
	 */
	async unknownTransaction(ctx){		
    throw new Error('a custom error message')
	}

	async beforeTransaction(ctx){
		console.info(`Transaction ID: ${ctx.stub.getTxID()}`);
	}

	async afterTransaction(ctx,result){
		// log result to preferred log implementation
		// emit events etc...
	}

	async aroundTransaction(ctx, fn, parameters) {
		try {
      // don't forget to call super, or your transaction function won't run!
			super.aroundTransaction(ctx, fn, parameters)
		} catch (error) {
			// do something with the error, then rethrow
			throw error
		}
	}

```

### Structure of the Transaction Context

In Fabric, there is a *stub* api that provides chaincode with functionality.
No functionality has been removed, but a new approach to providing abstractions on this to facilitate programming.

*user additions*:  additional properties can be added to the object to support for example common handling of the data serialization.

The context object contains

- `ctx.stub`  the same stub instance as in earlier versions for compatibility
- `ctx.identity` and instance of the Client Identity object

You are at liberty to create a subclass of the Context to provide additional functions, or per-transaction context storage. For example

```
	/**
	 * Custom context for use within this contract
	 */
	createContext(){
		return new ScenarioContext();
	}
```

and the Context class itself is

```
const { Context } = require('fabric-contract-api');

class ScenarioContext extends Context{

	constructor(){
		super();
	}

	generateKey(){
		return this.stub.createCompositeKey('type',['keyvalue']);
	}

}

```

## Node.js Chaincode API rules

Definitions as per https://www.ietf.org/rfc/rfc2119.txt

- All the functions that are present in the prototype of a class that extends *Contract* will be invokable
- The exports from the node module *MUST* include *contracts* that is an array of constructors (1 or more)
- Each class *MAY* call in it's constructor pass a name. This is prefixed to each of the function names by an _  (underscore)
- Each class *MAY* define functions that are executed before and functions that are executed after the invoked function.
  - These are part of the same fabric transaction
  - They are scoped per name
- Each class *MAY* define a function that would be executed if a matching function name does not exist; otherwise a 'no function exists' error will be thrown
- If too many parameters are passed, they will be discarded
- If too few parameters are passed, then the remainder will be set to undefined
	- as per node.js language standard
- Duplicate function names in a single class is an error
- Any function that is dynamically added will not be registered as an invokable function
- There are no specific function that is invoked per Fabric's *init* chaincode spi. The instantiate flow can pass function name and parameters; therefore consider
a dedicated function that will be called for new chaincode deployments, and for upgrade deployments.

## Restrictions on programming in side a Contract function

Hyperledger Fabric's consensus algorithm permits the ability to use general purpose languages; rather than a more restrictive language. But the following restrictions apply

- Functions should not create random variables, or use any function whose return values are functions of the current time or location of execution
  - i.e. the function will be executed in another context (i.e. peer process).  This could potentially be in a different time zone in a different locale.
- Functions should be away that they may read state, and write state. But they are producing a set of changes that will be applied to the state. The implication is that updates to the state
may not be read back.

```
let v1 = getState("key")
v1=="hello" // is true
putState("key","world")

let v2 = getState("key")
v2=="world" // is false,  v2 is "hello"
```

In any subsequent invocation, the value would be seen to be updated.

Note that if you have use any Flux architecture implications such as Redux, the above restrictions will be familiar.








