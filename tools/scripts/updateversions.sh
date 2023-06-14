#!/usr/bin/env bash

set -eo pipefail

if [ -z "$1" ]; then
    echo "Need to have the first arg set to the new package.json version"
    exit 1
fi

NEW_VERSION="$1"
echo "Setting new version to '${NEW_VERSION}'"

while read -r PACKAGE; do
    echo "Updating '${PACKAGE}'"
    ( cd "$(dirname "${PACKAGE}")" && npm --allow-same-version --no-git-tag-version version "${NEW_VERSION}" )
done <<< "$(find . -type d \( -name node_modules -o -name common \) -prune -o -type f -name package.json -print)"

MAJOR_MINOR=$(cut -d. -f-2 <<< "${NEW_VERSION}")

echo "Please also check these files containing ${MAJOR_MINOR}.n"
# NB - the grep regexp syntax is a little different
MAJOR_MINOR_REGEX="${MAJOR_MINOR/./\.}\.\?[0-9]"
find . -type d \( -name node_modules -o -name common \) -prune -o -type f -name '*.js' -exec grep "${MAJOR_MINOR_REGEX}" {} +
