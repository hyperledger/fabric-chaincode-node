#### Writing your own chaincode

To write your own chaincode is very easy. Create a file named `mychaincode.js` anywhere in the file system.
```
cd ~
mkdir mycc
cd mycc
// create a new node project
npm init
// install fabric-shim at main branch
npm install fabric-shim@2.3.1-unstable
// or using the released version
npm install fabric-shim
touch mychaincode.js
```

Put the following minimum implementation to `mychaincode.js`:
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

Finally, update the "start" script in package.json to "node mychaincode.js":
```
{
	"name": "mychaincode",
	"version": "1.0.0",
	"description": "My first exciting chaincode implemented in node.js",
	"engines": {
		"node": "^12.16.1",
		"npm": "^6.4.1"
	},
        "scripts": { "start" : "node mychaincode.js" },
	"engine-strict": true,
	"engineStrict": true,
	"license": "Apache-2.0",
	"dependencies": {
		"fabric-shim": "2.3.1-unstable"
	}
}
```

Now you need to restart the peer in "network" mode instead of "dev" mode.

#### Using Docker

If you used 'gulp channel-init', change directory to the fabric-chaincode-node, set an environment variable "DEVMODE=false" and run the command again.
```
cd fabric-chaincode-node
DEVMODE=false gulp channel-init
```

Next, copy a chaincode to the folder mounted on CLI container and enter the CLI container.
```
cp -r ~/mycc /tmp/fabric-shim/chaincode
docker exec -it cli bash
```

Install the chaincode. The peer CLI will package the node.js chaincode source, without the "node_modules" folder, and send to the peer to install.
```
peer chaincode install -l node -n mycc -p /opt/gopath/src/github.com/mycc -v v0
```

Upon successful response, instantiate the chaincode on the "mychannel" channel created above:
```
peer chaincode instantiate -o orderer.example.com:7050 -C mychannel -l node -n mycc -v v0 -c '{"Args":["init"]}' -P 'OR ("Org1MSP.member")'
```

This will take a while to complete as the peer must perform npm install in order to build a custom docker image to launch the chaincode. When successfully completed, you should see in peer's log message confirmation of committing a new block. This new block contains the transaction to instantiate the chaincode "mycc:v0".

To further inspect the result of the chaincode instantiate command, run `docker images` and you will see a new image listed at the top of the list with the name starting with `dev-`. You can inspect the content of this image by running the following command:
```
docker exec -it dev-peer0.org1.example.com-mycc-v0 bash
root@c188ae089ee5:/# ls /usr/local/src
chaincode.js  fabric-shim  node_modules  package.json
root@c188ae089ee5:/#
```

Once the chaincode instantiation has completely successfully, you can send transaction proposals to it with the following commands.
```
peer chaincode invoke -o orderer.example.com:7050 -C mychannel -c '{"Args":["dummy"]}' -n mycc
```
