#!/bin/sh
#
# SPDX-License-Identifier: Apache-2.0
#
set -ex
INPUT_DIR=/chaincode/input
OUTPUT_DIR=/chaincode/output
cp -R ${INPUT_DIR}/src/. ${OUTPUT_DIR}
cd ${OUTPUT_DIR}
if [ -f package-lock.json -o -f npm-shrinkwrap.json ]; then
    npm ci --only=production
else
    npm install --production
fi