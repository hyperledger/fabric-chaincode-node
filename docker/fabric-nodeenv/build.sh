#!/bin/sh
#
# SPDX-License-Identifier: Apache-2.0
#
set -ex
INPUT_DIR=/chaincode/input
OUTPUT_DIR=/chaincode/output
cp -R ${INPUT_DIR}/src/. ${OUTPUT_DIR}
cd ${OUTPUT_DIR}

cat ${OUTPUT_DIR}/.npmrc
cat package.json

npm --version
npm config list


if [ -f package-lock.json -o -f npm-shrinkwrap.json ]; then
    npm ci --only=production --verbose
else
    npm install --production --verbose
fi