#!/bin/bash
# Note uses bash4.4 or later features, and sponge from GNU moreutils
set -eo pipefail

if [ -z $1 ]; then
    echo "Need to have the first arg set to the new package.json version "
    exit 1
fi

NEW_VERSION=$1
echo "Setting new version to '${NEW_VERSION}'"

readarray -d '' PACKAGES < <(find . -name package.json -not -path '*/node_modules/*' -not -path '*/common/*')

for PACKAGE in ${PACKAGES}
do
   echo "Updating '${PACKAGE}'"
   jq --arg VER "${NEW_VERSION}" '.version=$VER' "${PACKAGE}" | sponge "${PACKAGE}"
done


echo "Please also check these files"
# NB - the grep regexp syntax is a little different
find . -name "*.js" -not -path '*/node_modules/*' -not -path '*/common/*' | xargs grep "2\.4\.\?[0-9]"