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

    # Increment unstable version here
    UNSTABLE_VER=$(npm dist-tags ls "$1" | awk "/$CURRENT_TAG"":"/'{
    ver=$NF
    rel=$NF
    sub(/.*\./,"",rel)
    sub(/\.[[:digit:]]+$/,"",ver)
    print ver"."rel+1}')

      if [[ $UNSTABLE_VER = "" ]]; then
        echo -e "\033[34m  ----> unstable ver is blank" "\033[0m"
        UNSTABLE_INCREMENT=1
      else
        # Get last digit of the unstable version of $CURRENT_TAG
        UNSTABLE_INCREMENT=$(echo $UNSTABLE_INCREMENT| rev | cut -d '.' -f 1 | rev)
        echo "======> UNSTABLE_INCREMENT:" $UNSTABLE_INCREMENT
      fi

      echo -e "\033[32m======> UNSTABLE_INCREMENT: $UNSTABLE_INCREMENT" "\033[0m"

      # Append last digit with the package.json version
      export UNSTABLE_INCREMENT_VERSION=$RELEASE_VERSION.$UNSTABLE_INCREMENT
      echo "======> UNSTABLE_INCREMENT_VERSION:" $UNSTABLE_INCREMENT_VERSION

      # Replace existing version with $UNSTABLE_INCREMENT_VERSION
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
  echo -e "\033[32m ======> Current RELEASE_VERSION: $RELEASE_VERSION" "\033[0m"
}

cd $WORKSPACE/gopath/src/github.com/hyperledger/fabric-chaincode-node
npm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN

# Publish NPM modules
for modules in fabric-shim fabric-shim-crypto fabric-contract-api; do
     if [ -d "$modules" ]; then
        echo -e "\033[32m Publishing $modules" "\033[0m"
        cd $modules
        versions
        npmPublish $modules
        cd -
     fi
done
