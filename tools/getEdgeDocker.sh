#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#
set -euo pipefail

version=${FABRIC_VERSION:-2.5}
docker_registry=docker.io

for image in peer orderer baseos ccenv tools; do
    image_name="hyperledger/fabric-${image}"
    image_pull="${docker_registry}/${image_name}:${version}"
    docker pull -q "${image_pull}"
    docker tag "${image_pull}" "${image_name}"
done

docker pull -q couchdb:latest
docker pull -q "${docker_registry}/hyperledger/fabric-ca:1.5"
docker tag "${docker_registry}/hyperledger/fabric-ca:1.5" hyperledger/fabric-ca
