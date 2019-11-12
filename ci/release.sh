#!/bin/bash
# Release process for the Java chaincode is this
#
# > Work from the latest release-1.4 branch
# > Write a new release notes file along the lines of the the existing files
# > Run the script
#
#        ./scripts/release.sh
#
#   This will change the version to the correct release version and set the tag to mark the package
#   as npm publishable by the merge builds
# > Submit this to gerrit with this push command
#
#        git push origin HEAD:refs/for/release-1.4
#
# > When the build has complete, git pull to update your branch
# > To tag in gerrit run
#
#        ./scripts/gittag.sh
#
# > To update the version to a new snapshot leve run the
#
#        NEW_SUFFIX=snapshot ./scripts/release.sh
#
# > Push these changes as per normal


# Exit on first error, print all commands.
set -e
set -o pipefail
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

function abort {
    echo "!! Exiting shell script"
    echo "!!" "$1"
    exit -1
}

# need determine the release version
# Suffix can be added after the version eg rc or beta etc.
if [ -z ${NEW_SUFFIX+x} ]; then
  echo Suffix is not specified using pure version number
  NEW_VERSION=$(jq '.version' ${DIR}/package.json | sed -r "s/\"([0-9]?[0-9]\.[0-9]?[0-9]\.[0-9]?[0-9]).*/\1/")
  NEW_TAG="latest"
elif [[ ${NEW_SUFFIX} == 'snapshot' ]]; then
  echo new suffix is ${NEW_SUFFIX}
  CURRENT_VERSION=$(jq '.version' ${DIR}/package.json | sed -r "s/\"([0-9]?[0-9]\.[0-9]?[0-9]\.[0-9]?[0-9])(.)*/\1/")
  NEW_VERSION=$( ${DIR}/node_modules/.bin/semver -i ${CURRENT_VERSION} )-snapshot
  NEW_TAG="unstable-1.4"
else  # for beta, rc etc releases where the version doesn't change
  echo new suffix is ${NEW_SUFFIX}
  NEW_VERSION=$(jq '.version' ${DIR}/package.json | sed -r "s/\"([0-9]?[0-9]\.[0-9]?[0-9]\.[0-9]?[0-9])(.)*/\1-${NEW_SUFFIX}/")
  NEW_TAG="${NEW_SUFFIX}-1.4"
fi

echo New version string will be :${NEW_VERSION}:

# do the release notes and changelog for this new version exist if needed
if [[ ${NEW_TAG} == 'latest' ]]; then
    if [[ -f "${DIR}/release_notes/v${NEW_VERSION}.txt" ]]; then
    echo "Release notes exist, hope they make sense!"
    else
    abort "No releases notes under the file ${DIR}/release_notes/v${NEW_VERSION}.txt exist";
    fi

    OLD_VERSION=$(cat ./CHANGELOG.md | sed -n 1p | sed -n -e "s/.*v\(.*\)/\1/p")
    echo Previous version is v${OLD_VERSION}

    echo "Writing change log..."
    "${DIR}/ci/changelog.sh" "v${OLD_VERSION}" "v${NEW_VERSION}"
    echo "...done"
fi

# need to modify the package.json versions now to represent the updates
for PACKAGE in fabric-shim-crypto fabric-shim fabric-contract-api
do
    jq --arg VERSION "${NEW_VERSION}" --arg TAG "${NEW_TAG}" '.version = $VERSION | .tag = $TAG '  ${DIR}/${PACKAGE}/package.json  > ".tmp" && mv ".tmp" ${DIR}/${PACKAGE}/package.json
done

jq --arg VERSION "${NEW_VERSION}" '.version = $VERSION'  ${DIR}/package.json  > ".tmp" && mv ".tmp" ${DIR}/package.json
# This is a optional operation that can be done at any point to update the
# test to use a specific version of Fabric docker images etc
#

if [[ ${NEW_TAG} == 'latest' ]]; then
    echo "Please verify that all is well with the changes, add, comit and push to gerrit with"
    echo ""
    echo "git push origin HEAD:refs/for/release-1.4"
    echo ""
    echo "Wait for build to happen, which will push NPM modules, then run ./scripts/gittag.sh"
else
    echo "Please verify that all is well with the changes, and, commit and push to gerrit as normal"
fi