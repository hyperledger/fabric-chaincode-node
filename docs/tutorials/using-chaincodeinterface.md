#### Writing your own chaincode

To write your own chaincode is very easy. Create a file named `mychaincode.js` anywhere in the file system, and put in it the following minimum implementation:
```
const shim = require('fabric-shim');
const util = require('util');

var Chaincode = class {
        Init(stub) {
                return stub.putState('dummyKey', Buffer.from('dummyValue'))
                        .then(() => {
                                console.info('Chaincode instantiation is successful');
                                return shim.success();
                        }, () => {
                                return shim.error();
                        });
        }

        Invoke(stub) {
                console.info('Transaction ID: ' + stub.getTxID());
                console.info(util.format('Args: %j', stub.getArgs()));

                let ret = stub.getFunctionAndParameters();
                console.info('Calling function: ' + ret.fcn);

                return stub.getState('dummyKey')
                .then((value) => {
                        if (value.toString() === 'dummyValue') {
                                console.info(util.format('successfully retrieved value "%j" for the key "dummyKey"', value ));
                                return shim.success();
                        } else {
                                console.error('Failed to retrieve dummyKey or the retrieved value is not expected: ' + value);
                                return shim.error();
                        }
                });
        }
};

shim.start(new Chaincode());
```

Finally, create a file package.json at the same location, and put in the following content:
```
{
	"name": "mychaincode",
	"version": "1.0.0",
	"description": "My first exciting chaincode implemented in node.js",
	"engines": {
		"node": ">=8.4.0",
		"npm": ">=5.3.0"
	},
        "scripts": { "start" : "node mychaincode.js" },
	"engine-strict": true,
	"engineStrict": true,
	"license": "Apache-2.0",
	"dependencies": {
		"fabric-shim": "unastable"
	}
}
```

Now you need to restart the peer in "network" mode instead of "dev" mode:
* If you used binary command `peer`, restart the peer process in network mode by eliminating the `--peer-chaincodev` program argument
* If you used 'gulp channel-init', set an environment variable "DEVMODE=false" and run the command again

Install the chaincode. The peer CLI will package the node.js chaincode source, without the "node_modules" folder, and send to the peer to install. If you have previously installed a chaincode called by the same name and version, you can delete it from the peer by removing the file /var/hyperledger/production/chaincodes/<name>.<version>.
```
CORE_LOGGING_PEER=debug ./build/bin/peer chaincode install -l node -n mycc -v v0 -p <path to chaincode folder>
```

Upon successful response, instantiate the chaincode on the "test" channel created above:
```
CORE_LOGGING_PEER=debug ./build/bin/peer chaincode instantiate -o localhost:7050 -C mychannel -l node -n mycc -v v0 -c '{"Args":["init"]}' -P 'OR ("Org1MSP.member")'
```

This will take a while to complete as the peer must perform npm install in order to build a custom docker image to launch the chaincode. When successfully completed, you should see in peer's log message confirmation of committing a new block. This new block contains the transaction to instantiate the chaincode "mycc:v0".

To further inspect the result of the chaincode instantiate command, run `docker images` and you will see a new image listed at the top of the list with the name starting with `dev-`. You can inspect the content of this image by running the following command:
```
docker run -it dev-jdoe-mycc-v0 bash
root@c188ae089ee5:/# ls /usr/local/src
chaincode.js  fabric-shim  node_modules  package.json
root@c188ae089ee5:/#
```
