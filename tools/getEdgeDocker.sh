#!/bin/bash -e
set -euo pipefail

echo "======== PULL DOCKER IMAGES ========"

###############################################################
# Pull and Tag the fabric and fabric-ca images from Artifactory
###############################################################
echo "Fetching images from Artifactory"
ARTIFACTORY_URL=hyperledger-fabric.jfrog.io
ORG_NAME="hyperledger"

VERSION=2.0.0
ARCH="amd64"
: ${STABLE_VERSION:=$VERSION-stable}
STABLE_TAG=$ARCH-$STABLE_VERSION
MASTER_TAG=$ARCH-master

echo "---------> STABLE_VERSION:" $STABLE_VERSION

# Specifically not pulling down javaenv nodeenv
# javaenv not needed and we've just rebuilt the nodeenv

dockerTag() {
  for IMAGES in peer orderer ca ca orderer baseos ccenv  tools; do
    echo "Images: $IMAGES"
    echo
    docker pull $ARTIFACTORY_URL/fabric-$IMAGES:$STABLE_TAG
          if [[ $? != 0 ]]; then
             echo  "FAILED: Docker Pull Failed on $IMAGES"
             exit 1
          fi
    docker tag $ARTIFACTORY_URL/fabric-$IMAGES:$STABLE_TAG $ORG_NAME/fabric-$IMAGES
    docker tag $ARTIFACTORY_URL/fabric-$IMAGES:$STABLE_TAG $ORG_NAME/fabric-$IMAGES:$MASTER_TAG
    echo "$ORG_NAME/fabric-$IMAGES:$MASTER_TAG"
    echo "Deleting Artifcatory docker images: $IMAGES"
    docker rmi -f $ARTIFACTORY_URL/fabric-$IMAGES:$STABLE_TAG
  done
}

dockerTag

echo
docker images | grep "hyperledger"
echo
