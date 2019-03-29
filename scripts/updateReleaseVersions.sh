#!/bin/bash

# Exit on first error, print all commands.
set -ev
set -o pipefail

# Set DIR to the root of the repository
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
NEW_SUFFIX=rc1

NEW_VERSION=$(jq '.version' ${DIR}/package.json | sed -r "s/\"([0-9]?[0-9]\.[0-9]?[0-9]\.[0-9]?[0-9])-.*/\1-${NEW_SUFFIX}/")

echo $NEW_VERSION

jq --arg VERSION "${NEW_VERSION}" --arg SUFFIX "${NEW_SUFFIX}" '.version = $VERSION | .testFabricVersion = $VERSION'  ${DIR}/package.json  > ".tmp" && mv ".tmp" ${DIR}/${PACKAGE}/package.json
for PACKAGE in fabric-shim-crypto fabric-shim fabric-contract-api
do
    jq --arg VERSION "${NEW_VERSION}" --arg SUFFIX "${NEW_SUFFIX}" '.version = $VERSION | .tag = $SUFFIX '  ${DIR}/${PACKAGE}/package.json  > ".tmp" && mv ".tmp" ${DIR}/${PACKAGE}/package.json
done

SHIM_FILENAME="file:./fabric-shim-${NEW_VERSION}.tgz"
CONTRACT_FILENAME="file:./fabric-contract-api-${NEW_VERSION}.tgz"


for PACKAGE in fv/annotations fv/crud fv/query scenario
do
    jq --arg SHIM "${SHIM_FILENAME}" --arg CONTRACT "${CONTRACT_FILENAME}" '.dependencies["fabric-shim"] = $SHIM | .dependencies["fabric-contract-api"] = $CONTRACT '  ${DIR}/test/${PACKAGE}/package.json  > ".tmp" && mv ".tmp" ${DIR}/test/${PACKAGE}/package.json
done
