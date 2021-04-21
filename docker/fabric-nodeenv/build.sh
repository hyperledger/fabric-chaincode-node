#!/bin/sh
#
# SPDX-License-Identifier: Apache-2.0
#
set -ex
INPUT_DIR=/chaincode/input
OUTPUT_DIR=/chaincode/output
cp -R ${INPUT_DIR}/src/. ${OUTPUT_DIR}
cd ${OUTPUT_DIR}

ls -a ${OUTPUT_DIR}
cat ${OUTPUT_DIR}/.npmrc

ls -a ${INPUT_DIR}
cat ${INPUT_DIR}/src/.npmrc

if [ -f package-lock.json -o -f npm-shrinkwrap.json ]; then
    npm ci --only=production
else
    npm install --production
fi