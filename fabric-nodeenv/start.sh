#!/bin/sh
#
# SPDX-License-Identifier: Apache-2.0
#
set -ex
CHAINCODE_DIR=/usr/local/src
cd ${CHAINCODE_DIR}
npm start -- "$@"