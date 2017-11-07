## Hyperledger Fabric Shim for node.js chaincodes

This is the project for the fabric shim for node.js chaincodes development. The following instructions are oriented to a contributor or an early adopter and describes the steps to build and test the library.

As an application developer, to learn about how to implement **"Smart Contracts"** for the Hyperledger Fabric using Node.js, Please visit the [documentation](https://fabric-shim.github.io/).

This project publishes `fabric-shim` public npm package for developers consumption.

### Folder structure

The "src" folder contains the resources to become part of the npm package, including javascript files, protobuf definition files (.proto) that the code depends on, and a package.json to describe the package.

The "build" folder contains the "build" steps. This being javascript there's no need to compile, but special build steps are still needed to accomplish the following:
* linting: to make sure we enforce a somewhat consistent coding style
* dependency sharing: the proto files needed by the fabric-shim are a subset of what the fabric defines in the "protos" folder. They need to get copied to the proper locations for things to work, including the "src/lib/protos" folder so the code can load them

The "test" folder contains the unit and integration tests, as well as artifacts used by the tests

*Note:* npm 5 resolves the dependency "fabric-shim": "file:./src" by simply linking the folder "node_modules/fabric-shim" to the src folder, which makes it unnecessary to use a watcher.

### Set up the target network

Pre-requisites:
* node engine: LTS (8.9.0 or later, up to but not including 9.0.0)
* npm: 5.5.1 or later (usually comes with node install)
* gulp: must be globally installed in order to use the "gulp" command, `sudo npm install -g gulp`

Clone the fabric repo. This is required until a fabric release is published that supports node.js chaincode.
```
git clone ssh://<gerrit id>@gerrit.hyperledger.org:29418/fabric-chaincode-node
```

At this point you can proceed with one of the following two options to set up your local target network for testing.

#### Using Docker

This is the recommended way to set up a local environment, by using docker to run the peer and orderer nodes, and to use the binary commands inside the hyperledger/fabric-tools docker image (configtxgen, peer) to generate the bootstrap materials for the network, a.k.a the genesis block for the orderer and the channel transaction configuration for creating the channels.

Run this command from the fabric project, which was cloned above, to build the necessary docker images:
```
make docker-clean
make docker
```

You should also clone the `fabric-ca` repository and run the same two commands above.

You should then see a list of docker images when you run `docker images`, such as the following:
```
REPOSITORY                     TAG                              IMAGE ID            CREATED             SIZE
hyperledger/fabric-tools       latest                           e275b4dcad6e        4 days ago          1.34GB
hyperledger/fabric-tools       x86_64-1.0.1-snapshot-62fd2682   e275b4dcad6e        4 days ago          1.34GB
hyperledger/fabric-couchdb     latest                           7a2bb267be40        4 days ago          1.48GB
hyperledger/fabric-couchdb     x86_64-1.0.1-snapshot-62fd2682   7a2bb267be40        4 days ago          1.48GB
hyperledger/fabric-orderer     latest                           271f0855f8df        4 days ago          179MB
hyperledger/fabric-orderer     x86_64-1.0.1-snapshot-62fd2682   271f0855f8df        4 days ago          179MB
hyperledger/fabric-peer        latest                           a8a801ad4865        4 days ago          182MB
hyperledger/fabric-peer        x86_64-1.0.1-snapshot-62fd2682   a8a801ad4865        4 days ago          182MB
hyperledger/fabric-ccenv       latest                           1b05ef3e62c6        4 days ago          1.29GB
hyperledger/fabric-ccenv       x86_64-1.0.1-snapshot-62fd2682   1b05ef3e62c6        4 days ago          1.29GB
hyperledger/fabric-ca          latest                           2acc2db19d7f        4 days ago          238MB
hyperledger/fabric-ca          x86_64-1.0.1-snapshot-e2bde12    2acc2db19d7f        4 days ago          238MB
```

These are the docker images needed to execute the tests. You may have more images built by the make commands.

The follow script that brings up a fabric network is based on the *basic network* sample in the `fabric-samples` repository. You should clone it from the parent folder of the `fabric-chaincode-node` project, such that after cloning the two projects are next to each other in the file system:
```
git clone ssh://<gerrit id>@gerrit.hyperledger.org:29418/fabric-samples
```

The resulting folder structure should be:
```
<parent folder>
   |_ fabric-chaincode-node
   |_ fabric-samples
```

Next run this single command to bring up a basic network of one orderer (using "SOLO"), one peer (using CouchDB as state database), then create a channel called "mychannel", and join the peer to that channel:
```
gulp channel-init
```

You should see the following docker instances with the `docker ps` command:
```
CONTAINER ID        IMAGE                               COMMAND                  CREATED             STATUS              PORTS                                            NAMES
a086c14cbad9        hyperledger/fabric-peer:latest      "peer node start"        18 hours ago        Up 18 hours         0.0.0.0:7051->7051/tcp, 0.0.0.0:7053->7053/tcp   peer0.org1.example.com
651bcbb5a1a4        hyperledger/fabric-ca:latest        "sh -c 'fabric-ca-..."   18 hours ago        Up 18 hours         0.0.0.0:7054->7054/tcp                           ca.example.com
50316f8422ff        hyperledger/fabric-orderer:latest   "orderer"                18 hours ago        Up 18 hours         0.0.0.0:7050->7050/tcp                           orderer.example.com
bfd9120b530c        hyperledger/fabric-couchdb:latest   "tini -- /docker-e..."   18 hours ago        Up 18 hours         4369/tcp, 9100/tcp, 0.0.0.0:5984->5984/tcp       couchdb
c2aaaed2056d        hyperledger/fabric-tools:latest     "/bin/bash"              18 hours ago        Up 18 hours                                                          cli
```

One more thing to do before you start testing the chaincode. The docker-based network uses organization MSPs that are defined in the basic-network sample, instead of the default. Therefore when you send requests with the `peer` command to the network later, the command must also have the proper corresponding MSP configurations in order to be properly recognized by the peer and orderer. To do that, you need to set the following environment variables:
```
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_MSPCONFIGPATH=<path to fabric-samples>/basic-network/crypto-config/peerOrganizations/org1.example.com/users/Admin\@org1.example.com/msp
```

You can now proceed to the section "Test Node.js Chaincode".

#### Using Command Binaries

Alternatively you can use the `peer` and `orderer` binaries to manually start the target network and initialize the channel.

Run these commands to build the executabiles needed for the test environment:
```
make peer
make orderer
make configtxgen
```

Use the configtxgen tool to generate a genesis block and a channel config:
```
./build/bin/configtxgen -outputBlock sampleconfig/test.genesis.block -profile SampleSingleMSPSolo
./build/bin/configtxgen -outputCreateChannelTx sampleconfig/test.tx -profile SampleSingleMSPChannel -channelID mychannel
```

Then you can launch a peer node and an orderer node with the following commands:
```
CORE_CHAINCODE_LOGGING_SHIM=debug CORE_LOGGING_PEER=debug CORE_PEER_ADDRESSAUTODETECT=true ./build/bin/peer node start --peer-chaincodedev
ORDERER_GENERAL_LISTENADDRESS=0.0.0.0 ORDERER_GENERAL_GENESISMETHOD=file ORDERER_GENERAL_GENESISFILE=./test.genesis.block ./build/bin/orderer
```

Create a channel and join the peer to the channel:
```
./build/bin/peer channel create -o localhost:7050 -c mychannel -f ./sampleconfig/test.tx
./build/bin/peer channel join -b ./test.block
```

### Test Node.js Chaincode

Now you are ready to test the node.js chaincode. Change directory to the fabric-chaincode-node folder. For now only a simple test is available, which is "test.js". Before you can launch that, run these commands first:
```
npm install
gulp protos
```

Run the following command to launch the test (replacing "192.168.1.64" with the IP address of the target peer):
```
CORE_CHAINCODE_ID_NAME="mycc:v0" node test/integration/test.js --peer.address grpc://192.168.1.64:7052
```

You should see a confirmation message in the peer's log about the REGISTER request being handled successfully.

You can then issue commands to install and instantiate the chaincode. From the "fabric" folder:
```
CORE_LOGGING_PEER=debug ./build/bin/peer chaincode install -l node -n mycc -p <path to test/integration> -v v0
CORE_LOGGING_PEER=debug ./build/bin/peer chaincode instantiate -o localhost:7050 -C mychannel -l node -n mycc -v v0 -c '{"Args":["init"]}' -P 'OR ("DEFAULT.member")'
```

Note that in the above steps, an "install" call was made to upload the chaincode source to the peer, even though the chaincode is running locally already and has registered with the peer. This is a dummy step only to make the peer logic happy when it checks for the file corresponding to the chaincode during instantiate.

Once the chaincode instantiation has completely successfully, you can send transaction proposals to it with the following commands.

```
CORE_LOGGING_PEER=debug ./build/bin/peer chaincode invoke -o localhost:7050 -C test -c '{"Args":["test1"]}' -n mycc
```

In the output of the command, you should see the following indiciating successful completion of the transaction:
```
2017-08-14 16:24:04.225 EDT [chaincodeCmd] chaincodeInvokeOrQuery -> INFO 00a Chaincode invoke successful. result: status:200
```

### Run the unit and integration tests

The project is equipped with both unit tests (runs standalone) and integration tests (requires a target fabric network).
* to run the unit tests:
```
gulp test-headless
```
* to run the integration tests (TLS disabled):
```
DEVMODE=false gulp channel-init
gulp test-e2e
```
* to run the integration tests with TLS:
```
TLS=true DEVMODE=false gulp channel-init
TLS=true gulp test-e2e
```

**NOTE:** If both DEVMODE & TLS are *true* you will have to generate TLS Certs for the chaincode

### Test the chaincode in peer network mode

The above runs the peer in *chaincode dev mode*. It calls the locally launched chaincode process (the one started by the `node test/integration/test.js` command). You can also test chaincodes in real runtime mode meant for production, also known as the *network mode*.

First of all, you need to provide all the necessary files for running the chaincode in the network mode.

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
