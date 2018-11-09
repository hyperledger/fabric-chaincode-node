#!/bin/bash -e
#
# Copyright IBM Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#

#################################################
#Publish npm module as unstable after merge commit
#npm publish --tag $CURRENT_TAG
#Run this "npm dist-tags ls $pkgs then look for
#unstable versions
#################################################

npmPublish() {

if [[ "$CURRENT_TAG" = *"skip"* ]]; then
      echo "----> Don't publish npm modules on skip tag"
elif [[ "$CURRENT_TAG" = *"unstable"* ]]; then
    # Get the version from npmjs of the  module
    echo
    UNSTABLE_VER=$(npm dist-tags ls "$1" | awk "/$CURRENT_TAG"":"/'{
    ver=$NF
    sub(/.*\./,"",rel)
    sub(/\.[[:digit:]]+$/,"",ver)
    print ver}')

    echo "======> UNSTABLE VERSION --> $UNSTABLE_VER"

    # Increment unstable version here
    UNSTABLE_INCREMENT=$(npm dist-tags ls "$1" | awk "/$CURRENT_TAG"":"/'{
    ver=$NF
    rel=$NF
    sub(/.*\./,"",rel)
    sub(/\.[[:digit:]]+$/,"",ver)
    print ver"."rel+1}')

    echo "======> Incremented UNSTABLE VERSION --> $UNSTABLE_INCREMENT"

    # Get the last incremented digit of $CURRENT_TAG from npm
    UNSTABLE_INCREMENT=$(echo $UNSTABLE_INCREMENT| rev | cut -d '.' -f 1 | rev)
    echo "======> UNSTABLE_INCREMENT : $UNSTABLE_INCREMENT"

    # Append incremented number to the version in package.json
    export UNSTABLE_INCREMENT_VERSION=$RELEASE_VERSION.$UNSTABLE_INCREMENT
    echo "======> UNSTABLE_INCREMENT_VERSION" $UNSTABLE_INCREMENT_VERSION

    # Replace the existing version with $UNSTABLE_INCREMENT_VERSION
    sed -i 's/\(.*\"version\"\: \"\)\(.*\)/\1'$UNSTABLE_INCREMENT_VERSION\"\,'/' package.json
    npm publish --tag $CURRENT_TAG

else
    # Publish node modules on latest tag
    echo -e "\033[32m ======> RELEASE_VERSION: $RELEASE_VERSION" "\033[0m"
    echo
    echo -e "\033[32m ======> CURRENT_TAG: $CURRENT_TAG" "\033[0m"

    npm publish --tag $CURRENT_TAG

fi
}
versions() {

  # Get the value of the tag from package.json
  CURRENT_TAG=$(cat package.json | grep tag | awk -F\" '{ print $4 }')
  echo -e "\033[32m ======> CURRENT_TAG: $CURRENT_TAG" "\033[0m"

  # Get the version from package.json
  RELEASE_VERSION=$(cat package.json | grep version | awk -F\" '{ print $4 }')
  echo -e "\033[32m ======> Current RELEASE VERSION: $RELEASE_VERSION" "\033[0m"

}

echo -e "\033[32m ====== PUBLISH NPM MODULES ======" "\033[0m"
cd $WORKSPACE/gopath/src/github.com/hyperledger/fabric-chaincode-node
npm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN

cd fabric-shim
# call versions func
versions
# Publish fabric-shim npm module
echo -e "\033[32m ======> Publishing fabric-shim" "\033[0m"
npmPublish fabric-shim

cd ../fabric-shim-crypto
# call versions func
versions
# Publish fabric-shim-crypto npm module
echo -e "\033[32m ======> Publishing fabric-shim-crypto" "\033[0m"
npmPublish fabric-shim-crypto

cd ../fabric-contract-api
# call versions func
versions
# Publish fabric-contract-api npm module
echo -e "\033[32m ======> Publishing fabric-contract-api" "\033[0m"
npmPublish fabric-contract-api
