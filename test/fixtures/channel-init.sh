#!/bin/bash
# Copyright London Stock Exchange Group All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#
echo
echo " ____    _____      _      ____    _____           _____   _   _   _____   _____ "
echo "/ ___|  |_   _|    / \    |  _ \  |_   _|         |_   _| | \ | | |_   _| |_   _|"
echo "\___ \    | |     / _ \   | |_) |   | |    _____    | |   |  \| |   | |     | |  "
echo " ___) |   | |    / ___ \  |  _ <    | |   |_____|  _| |_  | |\  |  _| |_    | |  "
echo "|____/    |_|   /_/   \_\ |_| \_\   |_|           |_____| |_| \_| |_____|   |_|  "
echo

CHANNEL_NAME="$1"
: ${CHANNEL_NAME:="mychannel"}
: ${TIMEOUT:="60"}
COUNTER=1
MAX_RETRY=5
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

echo "Channel name : "$CHANNEL_NAME

verifyResult () {
	if [ $1 -ne 0 ] ; then
		echo "!!!!!!!!!!!!!!! "$2" !!!!!!!!!!!!!!!!"
                echo "================== ERROR !!! FAILED to execute Test Init =================="
		echo
   		exit 1
	fi
}

setGlobals () {

	CORE_PEER_LOCALMSPID="Org1MSP"
	CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
	CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
	CORE_PEER_ADDRESS=peer0.org1.example.com:7051

	env |grep CORE
}

createChannel() {
	setGlobals

	if [ -z "$CORE_PEER_TLS_ENABLED" -o "$CORE_PEER_TLS_ENABLED" = "false" ]; then
		peer channel create -o orderer.example.com:7050 -c $CHANNEL_NAME -f /etc/hyperledger/configtx/channel.tx >&log.txt
	else
		peer channel create -o orderer.example.com:7050 -c $CHANNEL_NAME -f /etc/hyperledger/configtx/channel.tx --tls $CORE_PEER_TLS_ENABLED --cafile $ORDERER_CA >&log.txt
	fi
	res=$?
	cat log.txt
	verifyResult $res "Channel creation failed"
	echo "===================== Channel \"$CHANNEL_NAME\" is created successfully ===================== "
	echo
}

## Sometimes Join takes time hence RETRY atleast for 5 times
joinWithRetry () {
	peer channel join -b $CHANNEL_NAME.block  >&log.txt
	res=$?
	cat log.txt
	if [ $res -ne 0 -a $COUNTER -lt $MAX_RETRY ]; then
		COUNTER=` expr $COUNTER + 1`
		echo "PEER0 failed to join the channel, Retry after 2 seconds"
		sleep 2
		joinWithRetry
	else
		COUNTER=1
	fi
        verifyResult $res "After $MAX_RETRY attempts, PEER0 has failed to Join the Channel"
}

joinChannel () {
	setGlobals
	joinWithRetry
	echo "===================== PEER0 joined on the channel \"$CHANNEL_NAME\" ===================== "
	sleep 2
	echo
}

## Create channel
echo "Creating channel..."
createChannel

## Join all the peers to the channel
echo "Having all peers join the channel..."
joinChannel

echo
echo "===================== All GOOD, Test Init execution completed ===================== "
echo

echo
echo " _____   _   _   ____            _____   _   _   _____   _____ "
echo "| ____| | \ | | |  _ \          |_   _| | \ | | |_   _| |_   _|"
echo "|  _|   |  \| | | | | |  _____    | |   |  \| |   | |     | |  "
echo "| |___  | |\  | | |_| | |_____|  _| |_  | |\  |  _| |_    | |  "
echo "|_____| |_| \_| |____/          |_____| |_| \_| |_____|   |_|  "
echo

exit 0
