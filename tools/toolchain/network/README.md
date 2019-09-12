# Setup for preparing network for testing
## Step 1 - Start non peer CLI and use it to generate crypto material

Start the docker container
```
docker-compose -f docker-compose-cli.yaml up -d 
```

Generate crytpo-config:
```
docker exec cli cryptogen generate --config=/etc/hyperledger/config/crypto-config.yaml --output /etc/hyperledger/config/crypto-config
```

Generate the genesis block:
```
docker exec cli configtxgen -profile TwoOrgsOrdererGenesis -outputBlock /etc/hyperledger/config/genesis.block
```

Generate the channel transaction:
```
docker exec cli configtxgen -profile TwoOrgsChannel -outputCreateChannelTx /etc/hyperledger/config/channel.tx -channelID mychannel
```

Copy core.yaml to FABRIC_CFG_PATH:
```
docker exec cli cp /etc/hyperledger/fabric/core.yaml /etc/hyperledger/config
```

Destroy cli container:
```
docker-compose -f docker-compose-cli.yaml down --volumes
```

## Step 2 - Start fabric network containers and configure network (non-TLS)
Startup containers:
```
docker-compose -f docker-compose.yaml -p node up -d
```

Create the channel:
```
docker exec org1_cli peer channel create -o orderer.example.com:7050 -c mychannel -f /etc/hyperledger/configtx/channel.tx --outputBlock /etc/hyperledger/configtx/mychannel.block
```

Connect peer0.org1.example.com to the channel:
```
docker exec org1_cli peer channel join -b /etc/hyperledger/configtx/mychannel.block
```

Connect peer0.org2.example.com to the channel:
```
docker exec org2_cli peer channel join -b /etc/hyperledger/configtx/mychannel.block
```

## Step 2 - Start fabric network containers and configure network (TLS)
Startup containers:
```
docker-compose -f docker-compose-tls.yaml -p node up -d
```

Create the channel:
```
docker exec org1_cli peer channel create -o orderer.example.com:7050 -c mychannel -f /etc/hyperledger/configtx/channel.tx --tls true --cafile /etc/hyperledger/config/crypto/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem --outputBlock /etc/hyperledger/configtx/mychannel.block
```

Connect peer0.org1.example.com to the channel:
```
docker exec org1_cli peer channel join -b /etc/hyperledger/configtx/mychannel.block --tls true --cafile /etc/hyperledger/config/crypto/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem
```

Connect peer0.org2.example.com to the channel:
```
docker exec org2_cli peer channel join -b /etc/hyperledger/configtx/mychannel.block --tls true --cafile /etc/hyperledger/config/crypto/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem
```

## Step 3 - Play with chaincodes (non-TLS)
Copy to the chaincode folder the packed version of these packages.

Install scenario chaincode (all peers in channel):
```
docker exec org1_cli peer chaincode install -l node -n mycc -v 0 -p /opt/gopath/src/github.com/chaincode/scenario
docker exec org2_cli peer chaincode install -l node -n mycc -v 0 -p /opt/gopath/src/github.com/chaincode/scenario
```

Instantiate the chaincode:
```
docker exec org1_cli peer chaincode instantiate -o orderer.example.com:7050 -l node -C mychannel -n mycc -v 0 -c '{"Args":["UpdateValues:setup"]}' -P 'OR ("Org1MSP.member")'
```

## Step 3 - Play with chaincodes (TLS)
Copy to the chaincode folder the packed version of these packages.

Install scenario chaincode (all peers in channel):
```
docker exec org1_cli peer chaincode install -l node -n mycc -v 0 -p /opt/gopath/src/github.com/chaincode/scenario
docker exec org2_cli peer chaincode install -l node -n mycc -v 0 -p /opt/gopath/src/github.com/chaincode/scenario
```

Instantiate the chaincode:
```
docker exec org1_cli peer chaincode instantiate -o orderer.example.com:7050 -l node -C mychannel -n mycc -v 0 -c '{"Args":["UpdateValues:setup"]}' -P 'OR ("Org1MSP.member")' --tls true --cafile /etc/hyperledger/config/crypto/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem
```