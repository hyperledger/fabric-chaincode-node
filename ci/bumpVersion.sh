#!/bin/bash
#
# SPDX-License-Identifier: Apache-2.0
#
# Exit on first error, print all commands.
set -ex
set -o pipefail
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

function abort {
    echo "!! Exiting shell script"
    echo "!!" "$1"
    exit -1
}

# Ensnure the new version is set
VERSION=$1
: ${VERSION:?}

NEW_TAG="latest-1.4"

# need to modify the package.json versions now to represent the updates
for PACKAGE in fabric-shim-crypto fabric-shim fabric-contract-api
do
    jq --arg VERSION "${VERSION}" --arg TAG "${NEW_TAG}" '.version = $VERSION | .tag = $TAG '  ${DIR}/${PACKAGE}/package.json  > ".tmp" && mv ".tmp" ${DIR}/${PACKAGE}/package.json
done

jq --arg VERSION "${VERSION}" --arg TAG "${NEW_TAG}" '.version = $VERSION | .tag = $TAG '  ${DIR}/package.json  > ".tmp" && mv ".tmp" ${DIR}/package.json
# This is a optional operation that can be done at any point to update the
# test to use a specific version of Fabric docker images etc
