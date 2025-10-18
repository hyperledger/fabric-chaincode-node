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
    && ./install-fabric.sh binary docker samples

pushd "${ROOT_DIR}/fabric-samples"

pushd "${ROOT_DIR}/fabric-samples/test-network"
./network.sh down
./network.sh up createChannel -ca -s couchdb

# unwind the stack
popd
popd
popd
