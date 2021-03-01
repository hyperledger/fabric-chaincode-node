#!/bin/bash
set -e -o pipefail

# Root of the version that we will be looking for and publishing on
RELEASE_VERSION=2.3.1-snapshot

# get the currently published versions, pull out the versions
V=$(npm view fabric-contract-api --json | jq -r --arg VER ${RELEASE_VERSION} '.versions[] | select(test($VER))' | awk -F"." '{print $4+1}' | sort -n | tail -1)
FULL_VERSION=${RELEASE_VERSION}.${V:-1}

F=$(find . -wholename "./apis/**/package.json" -or -wholename "./libraries/**/package.json" -or -wholename "./test/**/package.json")
for PACKAGE_JSON in $F 
do
  # jq --arg ver $FULL_VERSION '.version=$ver' ${pf} | sponge ${pf}
  export PACKAGE_JSON
  export FULL_VERSION
  node - << EOF
  const fs = require('fs')
  let input = JSON.parse(fs.readFileSync(process.env.PACKAGE_JSON));
  let ver = process.env.FULL_VERSION;
  input.version=ver;
  if (input.dependencies){
    if (input.dependencies['fabric-contract-api'])  input.dependencies['fabric-contract-api']=ver;
    if (input.dependencies['fabric-ledger'])  input.dependencies['fabric-ledger']=ver;
    if (input.dependencies['fabric-shim'])  input.dependencies['fabric-shim']=ver;
    if (input.dependencies['fabric-shim-api'])  input.dependencies['fabric-shim-api']=ver;
    if (input.dependencies['fabric-shim-crypto'])  input.dependencies['fabric-shim-crypto']=ver;
  }
  fs.writeFileSync(process.env.PACKAGE_JSON,JSON.stringify(input,null,2));
EOF

done




