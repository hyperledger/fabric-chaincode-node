# Releasing

The following artifacts are created as a result of releasing Fabric Chaincode Node:

- docker images
    - [fabric-nodeenv](https://hub.docker.com/r/hyperledger/fabric-nodeenv)
- npm modules
    - [fabric-contract-api](https://www.npmjs.com/package/fabric-contract-api)
    - [fabric-shim](https://www.npmjs.com/package/fabric-shim)
    - [fabric-shim-api](https://www.npmjs.com/package/fabric-shim-api)
    - [fabric-shim-crypto](https://www.npmjs.com/package/fabric-shim-crypto)

**Note:** A docker image with a matching V.R version is required before releasing a new version of Fabric.

## Before releasing

It's useful to create an issue to keep track of each release, for example [FABCN-377 Release v2.0.0 chaincode-node](https://jira.hyperledger.org/browse/FABCN-377).

The following tasks are required before releasing:

- Update version numbers in package.json files to the required version
- Update `tag` in package.json files to the required value, e.g. `beta`, or `latest`
- Update test, sample, and docs files to match the new version
- Create a new release notes file
- Update the `CHANGELOG.md` file
  
  The `changelog.sh` script in `tools/scripts` will prepopulate the changelog but you must check and edit the file manually afterwards as required

See the [Prepare 2.1.4 release](https://github.com/hyperledger/fabric-chaincode-node/pull/174) pull request for an example, although be careful to search for all versions in the codebase as they're easy to miss and things change!

## Create release

Creating a GitHub release on the [releases page](https://github.com/hyperledger/fabric-chaincode-node/releases) will trigger the build to publish the new release.

When drafting the release, create a new tag for the new version (with a `v` prefix), e.g. `v2.1.4`

See previous releases for examples of the title and description.

## After releasing

- Update version numbers in package.json files to the next version appended with a `-unstable` pre-release label. e.g. `1.2.3-unstable`
- Update `tag` in package.json files to `unstable`
- Update test, sample, and docs files to match the new version

See the [Bump version to 2.1.5](https://github.com/hyperledger/fabric-chaincode-node/pull/175) pull request for an example. It should include almost all the files changed to prepare for the release, except for the release notes and changelog which do not need updating.
