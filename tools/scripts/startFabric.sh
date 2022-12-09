#!/bin/bash

# This starts up a Fabric Network for use by the integration tests
# PLEASE NOTE - this pulls the latest 'edge' version of the binaries
# Plans in place to update this a better version and to use the LTS 2.5 binaries once released

# Exit on first error, print all commands.
set -xeo pipefail

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/../.." && pwd )"

pushd "${ROOT_DIR}"
rm -rf "${ROOT_DIR}/fabric-samples" 

curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh \
    && chmod +x install-fabric.sh \
    && ./install-fabric.sh -f 2.5.0 samples

pushd "${ROOT_DIR}/fabric-samples"

find "${ROOT_DIR}/fabric-samples" -name configtx.yaml -exec yq -i '.Capabilities.Application.V2_5 = true  | del(.Capabilities.Application.V2_0)' {} \;

# get the edge binaries - these are the version 2.5
# the latest docker images are pulled elsewhere
curl -sSL https://hyperledger.jfrog.io/artifactory/fabric-binaries/hyperledger-fabric-ca-linux-amd64-2.5-stable.tar.gz | tar -xz
curl -sSL https://hyperledger.jfrog.io/artifactory/fabric-binaries/hyperledger-fabric-linux-amd64-2.5-stable.tar.gz | tar -xz


pushd "${ROOT_DIR}/fabric-samples/test-network" 
./network.sh down 
./network.sh up createChannel -ca -s couchdb

# unwind the stack
popd
popd
popd