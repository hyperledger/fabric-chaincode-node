## Hyperledger Fabric Shim for node.js chaincodes

This is the project for the fabric shim for node.js chaincodes development. The following instructions is oriented to a contributor or an early adopter and describes the steps to build and test the library. In time a public npm package will be published for consumption, with proper documentation for application developers.

### Folder structure

The "src" folder contains the resources to become part of the npm package, including javascript files, protobuf definition files (.proto) that the code depends on, and a package.json to describe the package.

The "test" folder contains the test code as well as any "build" steps. This being javascript there's no need to compile, but special build steps are still needed to accomplish the following:
* linting: to make sure we enforce a somewhat consistent coding style
* dependency sharing: the proto files needed by the fabric-shim are a subset of what the fabric defines in the "protos" folder. They need to get copied to the proper locations for things to work, including the "src/lib/protos" folder so the code can load them
* watch: a watcher can be set up for contributors so code changes can get propogated to node_modules automatically, so that code -> test cycles can go as smoothly as possible

### Getting started

Pre-requisites:
* node engine: 6.9.x (7.0 or higher is not supported at this point)
* npm: 3.10.x (usually comes with node install)
* gulp: must be globally installed in order to use the "gulp" command, `sudo npm install -g gulp`

After cloning the fabric repo, you must also download a changeset that is required to run node.js chaincodes. It is still being worked on so for the time being you must manually download the changeset before building the fabric peer.
```
git fetch ssh://<gerrit_id>@gerrit.hyperledger.org:29418/fabric refs/changes/23/11823/5 && git checkout FETCH_HEAD
```

Run these commands to build the executabiles needed for the test environment:
```
make peer
make orderer
make configtxgen
```

Use the configtxgen tool to generate a genesis block and a channel config:
```
./build/bin/configtxgen -outputBlock sampleconfig/test.genesis.block -profile SampleSingleMSPSolo
./build/bin/configtxgen -outputCreateChannelTx sampleconfig/test.tx -profile SampleSingleMSPChannel -channelID test
```

Then you can launch a peer node and an orderer node with the following commands:
```
CORE_CHAINCODE_LOGGING_SHIM=debug CORE_LOGGING_PEER=debug CORE_PEER_ADDRESSAUTODETECT=true ./build/bin/peer node start --peer-chaincodedev
ORDERER_GENERAL_LISTENADDRESS=0.0.0.0 ORDERER_GENERAL_GENESISMETHOD=file ORDERER_GENERAL_GENESISFILE=./test.genesis.block ./build/bin/orderer
```

Create a channel and join the peer to the channel:
```
./build/bin/peer channel create -o localhost:7050 -c test -f ./sampleconfig/test.tx
./build/bin/peer channel join -b ./test.block
```

Now you are ready to test the node.js chaincode. Change directory to the test folder (fabric/core/chaincode/shim/node/test). For now only a simple test is available, which is "test.js". Before you can launch that, run these commands first:
```
npm install
gulp protos
```

Run the following command to launch the test (replacing "192.168.1.64" with the IP address of the target peer):
```
CORE_CHAINCODE_ID_NAME="mycc:v0" node test.js --peer.address grpc://192.168.1.64:7051
```

You should see a confirmation message in the peer's log about the REGISTER request being handled successfully.

### Writing your own chaincode

To write your own chaincode is very easy. Create a file chaincode.js anywhere in the file system, and put in it the following minimum implementation:
```
const shim = require('fabric-shim');

var chaincode = {};
chaincode.Init = function() {
	return shim.success();
};

chaincode.Invoke = function() {
	return shim.success();
};

shim.start(chaincode);
```

At the same location, create a folder called `fabric-shim` and copy the files and folders from fabric/core/chaincode/shim/node/src to fabric-shim. Normally these resources would be downloaded from npmjs.com by `npm install`, but the fabric-shim package has not been published yet. Until then, you need to manually install the package by copying the source files.

Finally, create a file package.json at the same location, and put in the following content:
```
{
  "name": "mychaincode",
  "version": "1.0.0",
  "description": "My first exciting chaincode implemented in node.js",
  "engines": {
    "node": ">=6.9.5 <7.0",
    "npm": ">=3.10.10 <4.0"
  },
  "engine-strict": true,
  "engineStrict": true,
  "license": "Apache-2.0",
  "dependencies": {
    "fabric-shim": "file:./fabric-shim"
  }
}
```

Run `npm install` and launch the chaincode with:
```
CORE_CHAINCODE_ID_NAME="mycc:v0" node chaincode.js --peer.address grpc://192.168.1.64:7051
```

Once you see a message in the peer's log about the REGISTER request being processed successfully, you can then issue an instantiate command to get the peer to call the chaincode's Init() method, from the "fabric" folder:
```
CORE_LOGGING_PEER=debug ./build/bin/peer chaincode instantiate -o localhost:7050 -C test -l node -n mycc -v v0 -c '{"Args":["init"]}' -P 'OR ("DEFAULT.member")'
```

If the above steps are successful, you can then move on to try deploying the chaincode to a peer running in "network" mode instead of "dev" mode. Restart the peer process (or docker) in network mode by eliminating the `--peer-chaincodev` program argument. Then launch the following commands.

Install the chaincode. The peer CLI will package the node.js chaincode source, without the "node_modules" folder, and send to the peer to install. If you have previously installed a chaincode called by the same name and version, you can delete it from the peer by removing the file /var/hyperledger/production/chaincodes/<name>.<version>.
```
CORE_LOGGING_PEER=debug ./build/bin/peer chaincode install -l node -n mycc -v v0 -p <path-to-chaincode-folder>
```

Upon successful response, instantiate the chaincode on the "test" channel created above:
```
CORE_LOGGING_PEER=debug ./build/bin/peer chaincode instantiate -o localhost:7050 -C test -l node -n jscc -v v1 -c '{"Args":["init"]}' -P 'OR ("DEFAULT.member")'
```

This will take a while to complete as the peer must perform npm install in order to build a custom docker image to launch the chaincode. When successfully completed, you should see in peer's log message confirmation of committing a new block. This new block contains the transaction to instantiate the chaincode "mycc:v0".

To further inspect the result of the chaincode instantiate command, run `docker images` and you will see a new image listed at the top of the list called `dev-jdoe-mycc-v0`. You can inspect the content of this image by running the following command:
```
docker run -it dev-jdoe-mycc-v0 bash
root@c188ae089ee5:/# ls /usr/local/src
chaincode.js  fabric-shim  node_modules  package.json
root@c188ae089ee5:/# 
```
