#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ -z "$1" ]
  then
    SRC_ROOT="/tmp/fabric-shim/basic-network/scenario/src"
    echo "No arguments supplied"
  else
    SRC_ROOT="$1/fabric-shim/basic-network/scenario/src"
fi

export NPM_MODULES="fabric-shim fabric-shim-crypto fabric-contract-api"

cd "${SRC_ROOT}"

for j in ${NPM_MODULES}; do
    npm pack "${DIR}/../../${j}"
done 

cd -
