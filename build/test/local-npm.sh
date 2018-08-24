#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SRC_ROOT="/tmp/fabric-shim/basic-network/scenario/src"

export NPM_MODULES="fabric-shim fabric-shim-crypto fabric-contract-api"

cd "${SRC_ROOT}"

for j in ${NPM_MODULES}; do
    npm pack "${DIR}/../../${j}"
done 

cd -
