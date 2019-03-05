#!/bin/bash
# Copyright London Stock Exchange Group All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#
CHANNEL_NAME="$1"
: ${CHANNEL_NAME:="mychannel"}
: ${TIMEOUT:="60"}
COUNTER=1
MAX_RETRY=5
GENESIS_LOCATION=/etc/hyperledger/config
ORDERER_CA=/etc/hyperledger/config/crypto-config/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem

echo "Channel name : "$CHANNEL_NAME

verifyResult () {
	if [ $1 -ne 0 ] ; then
		echo "!!!!!!!!!!!!!!! "$2" !!!!!!!!!!!!!!!!"
                echo "================== ERROR !!! FAILED to execute Test Init =================="
		echo
   		exit 1
	fi
}

## Sometimes Join takes time hence RETRY atleast for 5 times
joinWithRetry () {
	peer channel join -b $GENESIS_LOCATION/$CHANNEL_NAME.block  >&log.txt
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
	joinWithRetry
	echo "===================== PEER0 joined on the channel \"$CHANNEL_NAME\" ===================== "
	sleep 2
	echo
}

## Join all the peers to the channel
echo "Having all peers join the channel..."
joinChannel

exit 0
