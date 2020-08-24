#!/bin/sh
#
# SPDX-License-Identifier: Apache-2.0
#
set -ex
INPUT_DIR=/chaincode/input
OUTPUT_DIR=/chaincode/output
cp -R ${INPUT_DIR}/src/. ${OUTPUT_DIR}
cd ${OUTPUT_DIR}
if [ -f chaincode.pkg ]; then
    ls --ignore="chaincode.pkg" | xargs rm -rf
    tar -xvf chaincode.pkg
    mv package/* .
    rm -rf chaincode.pkg package
elif [ -f package-lock.json -o -f npm-shrinkwrap.json ]; then
    npm ci --only=production
else
    npm install --production
fi
