#!/usr/bin/env bash

set -eo pipefail

if [ -z "$1" ]; then
    echo "Need to have the first arg set to the new package.json version"
    exit 1
fi

NEW_VERSION="$1"
echo "Setting new version to '${NEW_VERSION}'"

DEPENDENCIES=( fabric-contract-api fabric-shim-api fabric-shim fabric-ledger )

updatePackageVersion() {
    npm --allow-same-version --no-git-tag-version version "$1"
    for dependency in "${DEPENDENCIES[@]}"; do
        updateDependencyVersion "${dependency}" "$1"
    done
}

updateDependencyVersion() {
    local packageJson
    packageJson=$(node -e "const pkg = require('./package.json'); if (pkg.dependencies?.['$1']) pkg.dependencies['$1'] = '$2'; console.log(JSON.stringify(pkg, undefined, 2))")
    echo "${packageJson}" > package.json
}

while read -r PACKAGE; do
    echo "Updating '${PACKAGE}'"
    ( cd "$(dirname "${PACKAGE}")" && updatePackageVersion "${NEW_VERSION}" )
done <<< "$(find . -type d \( -name node_modules -o -name common -o -name tools \) -prune -o -type f -name package.json -print)"

MAJOR_MINOR=$(cut -d. -f-2 <<< "${NEW_VERSION}")

echo "Please also check these files containing ${MAJOR_MINOR}.n"
# NB - the grep regexp syntax is a little different
MAJOR_MINOR_REGEX="${MAJOR_MINOR/./\.}\.\?[0-9]"
find ./test \
    -type d \( -name node_modules -o -name '.*' \) -prune \
    -o -type f -name package.json -prune \
    -o -type f \( -name '*.js' -o -name '*.json' \) -exec grep "${MAJOR_MINOR_REGEX}" {} +
