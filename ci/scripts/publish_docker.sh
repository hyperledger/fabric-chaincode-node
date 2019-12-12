#!/bin/bash
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
set -euo pipefail

docker image load --input build/fabric-nodeenv.tar.gz         # gets the build image of nodeenv
docker images

docker login nexus3.hyperledger.org:10003 --username="${NEXUS_USERNAME}" --password="${NEXUS_PASSWORD}"
docker tag hyperledger/fabric-nodeenv "${NEXUS_URL}/fabric-nodeenv:amd64-2.0.0-beta"
docker push "${NEXUS_URL}/fabric-nodeenv:amd64-2.0.0-beta"
