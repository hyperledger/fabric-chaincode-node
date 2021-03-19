# Details on the programming model

Smart Contract packages consist of a set of code that contains the implementations of the code you want to run. Taken as a whole Hyperledger refers to this code as *chaincode*; a single chaincode is run within a docker container that is created and started by each peer.  Depending on the language, a nodejs, Java or Go runtime might be used within the docker containers.

## Node.js project structure

Each Smart Contract package is, from a node perspective, a NPM module.

- package.json
    - This needs to import the `fabric-contract-api` and `fabric-shim` npm modules
    - The 'start' script must be set to `fabric-chaincode-node-start` - this has to be present for the peer to call the node module to start
    - It is recommended to have a 'start:dev' script that can be used for development (details on this later)
    - A 'main' entry to point to your `index.js` file contain the exports of the node module

- index.js
    - It is mandatory to have a `contracts` element exported that is a array of classes.
    - Each of these classes must extend the `Contract` class from the `fabric-contract-api` module
    - Optionally, a custom `serializer` may be defined to control how data is converted for transmission between chaincode, peer and ultimately client applications (in future this could also include serialization to the ledger state).

*JavaScript example index.js*

```javascript
const cpcontract = require('./lib/papernet/papercontract.js');
module.exports.contracts = [cpcontract];

module.exports.CommercialPaper = require('./lib/papernet/paper.js');
```

*TypeScript example index.ts*

```typescript
import { GreetingContract } from './greetingcontract';
export { GreetingContract } from './greetingcontract';

export const contracts: any[] = [ GreetingContract ];
```

- META-INF/metadata.json (alternatively contract-metadata/metadata.json)

This file describes the *external* api that is exposed from these Smart Contracts; these are the functions that can be invoked by client applications. It describes all details about what is callable, and the datatypes of parameter and return values. It can also include information about documentation and licensing.

It describes the callable interface, and does not make any assertions about how the code is implemented.

## Defining your contract classes

The node module must export an array of one or more contract classes in the `contracts` property.
Each of these class must extend the correct type. At runtime each of these will have a single instance created, and will persist for the lifetime of the chaincode container.

> Each function MUST NOT use the instance to store data; all data MUST be stored within either the ledger, or within the transaction context

```typescript
import { Contract } from 'fabric-contract-api';

export class GreetingContract extends Contract {

    public constructor() {
        super('Greeting');
    }
}
```

The constructor must call super, the argument is optional but is used to name this instance, and is used to refer to this instance when it is called by client . applications. If no argument is supplied, then the name of the class is used (in this case GreetingContract ). If an empty string is supplied that is valid, but not recommended.

It is not recommended to supply the same name, the behaviour if function names within the two contracts overlap is undefined.

### Transaction Functions

Within each contract instance, you may has few or many functions as you wish. Each of them is eligible to a transaction function that is callable by applications.
If a function name is prefixed with a _ it will be ignored.  For Javascript all the functions will be eligible, but for Typescript the functions that are required must have a `@Transaction()` decorator

Each transaction must take as it's first parameter the transaction context

### Context

The first parameter is the 'transaction context' - it is quite plausible for several transactions to be invoked concurrently; the transaction context is required to give information specific to the transaction that is currently being executed.

Currently the 'stub' api for handling world state, and the 'Client Identity' is available from the context.
Each contract has a 'createContext' method that can be overridden by specific implementations to provide specific control to add information to the


### Before, After, Around and Unknown Functions

The Contract class defines three functions that can be overridden by specific implementations.

```javascript
    async beforeTransaction(ctx) {
        // default implementation is do nothing
    }

    async afterTransaction(ctx, result) {
        // default implementation is do nothing
    }

    async aroundTransaction(ctx, fn, parameters) {
        // default implementation invokes `fn`
    }
```

Before is called immediately before the transaction function, and after immediately afterwards. Note that before does not get the arguments to the function (note this was the subject of debate, opinions welcomed). After gets the result from the transaction function (this is the result returned from transaction function without any processing).

Around is the one responsible for invoking the trancaction function, and allows you to wrap all of them into a code block.

If the transaction function throws an Error then the whole transaction fails, likewise if the before or after throws an Error then the transaction fails. (note that if say before throws an error the transaction function is never called, nor the after. Similarly if transaction function throws an Error, after is not called. )

Typical use cases of these functions would be

- logging of the functions called
- checks of the identity of the caller
- wrap all functions into a try/catch

The unknown function is called if the requested function is not known; the default implementation is to throw an error. `You've asked to invoke a function that does not exist: {requested function}`
However you can implement an `unkownTransition` function - this can return a successful or throw an error as you wish.

```javascript
    async unknownTransaction(ctx) {
        // throw an error here or return succesfully if you wish
    }
```

## Metadata

### Supplying your own metadata
A correctly specified metadata file, at the top level has this structure

```json
{
    "$schema" : "https://hyperledger.github.io/fabric-chaincode-node/main/api/contract-schema.json",
    "info" : {

    },
    "contracts" : {

    },
    "components" : {

    }
}
```

The metadata file that the user specifies has precedence over the information generated from the code, on a per section basis. If the user has not specified any of the above sections, then the 'gap' will be filled with auto generated values.
