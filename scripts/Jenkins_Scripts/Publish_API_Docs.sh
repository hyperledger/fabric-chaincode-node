#!/bin/bash -e
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

cd ${WORKSPACE}/gopath/src/github.com/hyperledger/fabric-chaincode-node
# Generate chaincode-node API docs
gulp docs
CHAINCODE_NODE_COMMIT=$(git rev-parse --short HEAD)
echo "---------> CHAINCODE_NODE_COMMIT:" $CHAINCODE_NODE_COMMIT
TARGET_REPO=$CHAINCODE_NODE_USERNAME.github.io.git
git clone https://github.com/$CHAINCODE_NODE_USERNAME/$TARGET_REPO

# Remove API docs from Target repository
rm -rf $CHAINCODE_NODE_USERNAME.github.io/*

# Copy API docs to Target repository
cp -r docs/gen/* $CHAINCODE_NODE_USERNAME.github.io
cd $CHAINCODE_NODE_USERNAME.github.io
git add .
git commit -m "CHAINCODE_NODE commit - $CHAINCODE_NODE_COMMIT"
git config remote.gh-pages.url https://$CHAINCODE_NODE_USERNAME:$CHAINCODE_NODE_PASSWORD@github.com/$CHAINCODE_NODE_USERNAME/$TARGET_REPO

# Push API docs to Target repository
git push gh-pages master
