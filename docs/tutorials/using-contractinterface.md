

This outlines the theory of the how the new node module works; with the fabric samples project you will find scenario-based approaches. 

## Writing the chaincode

### 1: Chaincode is created as an npm module.

An initial `package.json` is as follows - the only runtime dependencay as far as anything blockchain is concerned is the `fabric-chaincode-api`.  This provides the API definition that can be used for development, and also unit test.

For development an implementation of the `fabric-shim` and specifically the CLI that accompanies it is required

**NOTE: for Fabric 1.3, this will need to be made a development dependency of the node model, and the `npm start` will need to call a defined app to start**

```
{
  "name": "chaincode",
  "description": "My first exciting chaincode implemented in node.js",
  "engines": {
    "node": ">=8.4.0",
    "npm": ">=5.3.0"
  },
  "scripts": {
	  "test":"mocha.....
  },
  "engine-strict": true,
  "engineStrict": true,
  "version": "1.0.0",
  "main": "index.js",
  "author": "",
  "license": "ISC",
  "dependencies": {
    "fabric-chaincode-api: "^1.3.0"
  }
}

```
Remember to add in any additionla business logic, and testing libraries needed. 

For 1.3 Fabric, please also add in `fabric-shim` as a dependency, and `node startChaincode` as the script to run for `npm start`. Therefore this would include

```
  "scripts": {
    "start": "startChaincode",
    "test": "nyc mocha test",
    ....
  },
  "dependencies": {
    "fabric-contract-api": "^1.3.0",
    "fabric-shim": "^1.3.0",
    ....
  },
```


### 2: How is chaincode deployed?

Chaincode is deployed by the peer in response to issuing a number of (usually CLI) commands. For node.js chaincode the location of the chaincode npm project is required (the directory that the package.json is in). This does not need to be an installed project, but has to have all the code, and the package.json.

A docker image is built for this chaincode, the package.json and code copied in. and `npm install` run.
> It is important to make sure that you have a `package-lock.json` to ensure the correct packages are imported.

After the install there is a 'bootstrap' process that starts the chaincode up (more details later). The constructors of the exported Contracts will be run at this point; these constructors are for setting the namespace and optionally  setup of the 'error/monitoring functions', (again more later). This instance of the contract will existing whilst this chaincode docker image is up.

When chaincode is instantiated or updated, the `init()` function is the chaincode is called. As with the `invoke()` call from the client, a fn name and parameters can be passed. Remember therefore to have specific functions to call on `init()` and `update()` in order to do any data initialization or migration that might be needed.  These two functions have been abstracted away to focus on specific function implementations.

### 3: What needs to be exported?

Node states that module exports are defined in `index.js`

In this example we have a single value that can be queried and updated. This has been split into to parts for demonstration purposes. 

```
// index.js
'use strict';

const UpdateValues = require('./updatevalues')
const RemoveValues = require('./removevalues')

module.exports.contracts = ['UpdateValues','RemoveValues'];
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
		super('org.mynamespace.updates');
	}

	async setup(ctx){
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
- The arguements are split out from the array passed on the invoke. 
- The constructor contains a 'namespace' to help indentifiy the sets of functions


### 5: Alteratnive ways of specifing the contracts

*package.json*

Insted of providing the Smart Contracts as exports, you can add details to the package.json. Using the above functions add this to the package.json

```
  "contracts":{
    "classes": ["removevalues.js","updatevalues.js"]
  }
```

If present this takes precedence over the exports.


*Programatically*
Note that programatic approach is now being considered as not a useful approach



## Running chaincode in dev mode

This is quite easy - as you need to run the startChaincode command.

```
$ npx startChaincode --peer.address localhost:7052
```

(this is actually what the peer does; this does mean that any chaincode that is written using the existing chaincode interface will continue to work as is.)

## Using this chaincode

Each of the functions can be invoked with arbitary arguements. The name of the function is of the format

```
[namespace_]functionname
```

If a namespace is given in the constructor then it will be prefixed separated by a _ (underscore)

> _assuming that you have a fabric up and running with the approriate environment variables set_

```
$ peer chaincode install --lang node --name mycontract --version v0 --path ~/chaincode-examples
$ peer chaincode instantiate --orderer localhost:7050 --channelID mychannel --lang node --name mycontract --version v0 -c '{"Args":["org.mynamespace.updates_setup"]}'
```

Will get things working...
Then you can invoke the chaincode via this command.

```
$ peer chaincode invoke --orderer localhost:7050 --channelID mychannel -c '{"Args":["org.mynamespace.removes_getAssetValue"]}' -n mycontract4  
```


## Additional support provided by the SmartContract class

In the case where you ask for a function to be executed, it could be the case that this doesn't exist. 
You can provide you own function to be executed in this case, the default is to throw and error but you're able to customise this if you wish. 

For example


```
	/** 
	 * Sets a namespace so that the functions in this particular class can 
	 * be separated from others.
	 */
	constructor() {
		super('org.mynamespace.updates');
		this.$setUnkownFn(this.unkownFn);
	}

	/** The function to invoke if something unkown comes in.
	 * 
	 */
	async uknownFn(api){
		console.log("Big Friendly letters ->>> DON\'T PANIC")
        throw new Error('Big Friendly letters ->>> DON\'T PANIC')
	}

```


## Node.js Chaincode API rules

Definitions as per https://www.ietf.org/rfc/rfc2119.txt

- All the functions that are present in the prototype of a class that extends *Contract* will be invokable
- The exports from the node module *MUST* include *contracts* that is an array of constructors (1 or more)
- Each class *MAY* call in it's constructor pass a namespace. This is prefixed to each of the function names by an _  (underscore)
- Each class *MAY* define functions that are executed before and functions that are executred after the invoked function.
  - These are part of the same fabric transaction
  - They are scoped per namespace
- Each class *MAY* define a function that would be executed if a matching function name does not exist; otherwise a 'no function exists' error will be thrown
- If too many parameters are passed, they will be discarded
- If too few parameters are passed, then the remainder will be set to undefiend
	- as per node.js language standard
- Duplicate function names in a single class is an error
- Any function that is dynamically added will not be registered as an invokeable function
- There are no specific function that is invoked per Fabric's *init* chaincode spi. The inistantiate flow can pass function name and parameters; therefore consider 
a dedicated function that will be called for new chaincode deployments, and for upgrade deployments.

## Restrictions on programming in side a Contract function

Hyperledger Fabric's consenusys algorithm permits the ability to use general purpose languages; rather than a more restricive language. But the following restrictions apply

- Functions should not create random variables, or use any function whos return values are functions of the current time or location of execution
  - i.e. the function will be excuted in another context (i.e. peer process).  This could potentially be in a different timezone in a different locale. 
- Functions should be away that they may read state, and write state. But they are producing a set of changes that will be applied to the state. The implication is that updates to the state
may not be read back.  

```
let v1 = getState("key")
v1=="hello" // is true
putState("key","world")

let v2 = getState("key")
v2=="world" // is false,  v2 is "hello"
```

In any subsequent innvocation, the value would be seen to be updated. 

Note that if you have use any Flux archiecture implications such as Redux, the above restrictions will be familar. 


### Structure of the Tranaction Context

In Fabric 1.2, there is a *stub* api that provides chaincode with functionality. 
No functionality has been removed, but a new approach to providing abstractions on this to faciliate programming.

*user additions*:  additional properties can be added to the object to support for example common handling of the data serialization.

The context object contains 

- `ctx.stub`  the same stub instance as in earlier versions for compatibility
- `ctx.identity` and instance of the Client Identity object 

### Extending the transaction context

If for example, we have a set of utilities functions that help with marhsalling data to and from the world state, we can 'inject' that into the context as 
follows

```
        this.setBeforeFn = (ctx)=>{
            ctx.datautil = new DataModel(ctx);
        };
```




