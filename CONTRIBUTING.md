## Contributing

We welcome contributions to the Hyperledger Fabric Project in many forms, and there's always plenty to do!

Please visit the [contributors guide](http://hyperledger-fabric.readthedocs.io/en/latest/CONTRIBUTING.html) in the docs to learn how to make contributions to this exciting project.

## Folder Structure

This repo is structured as a monorepo using [Rush](https://rushjs.io/). Why a monorepo? There are multiple npm modules that are published from this repo, including end to end tests, and tooling. It is significantly easier to manage within one repo - and Rush has proven to provide excellent support for management of issues such as different dependency versions.

The standard Rush conventions are followed as much as possible, deviation only (currently) in publishing and broad release version control. This deviation is to fit in with the existing Hyperledger Fabric release process - and some of these features in Rush are still evolving. This current Rush configuration is also not meant to be the final configuration; we are happy to entertain changes to improve the structure

### Categories

The following [Rush categories](https://rushjs.io/pages/maintainer/add_to_repo/) are used and exist as top level folders

- `apis` contains the `fabric-contract-api` and `fabric-shim-api` modules
- `tools` contains a set of scripts for build tooling (evolved from the `build` folder that existed previously)
- `libraries` contains the `fabric-shim` and `fabric-shim-crypto` modules
- `docker` contains the scripts and dockerfile for the nodeenv image
- `docs` contains the `apidocs` building scripts

### Pre-requisites

* node v12.16.1 (npm v6.4.1) => recommend to use [nvm](https://github.com/nvm-sh/nvm)
* rush => `npm install -g @microsoft/rush`

> Note that npm v6 has some bugs that mean adding new dependencies etc are not properly picked up. Longer term we should consider moving to yarn or pnpm. However in practice this isn't a serious problem and has been possible to be worked around by issuing `rm ./common/config/rush/npm-shrinkwrap.json` and then `rush update`

The fv and e2e tests require a set of docker images of Fabric Peers, Orderers and CAs. To ensure you have the correct images ensure these have been dowloaded and tagged.  `rush edge-docker` will do this for you.

They also need to have the `nodeenv` image present - this is build as part of the `rush rebuild` so please ensure this has been run first.  It is advisable to clean up the docker containers and images between test runs to avoid any odd behaviour. Commands to help do this are below.

## Using the repo

* Clone the repo, and ensure you are using node v12, and have rush installed
* `rush update` is needed to ensure everything is correctly linked and updated.
* `rush edge-docker` will pull down and tag the very latest docker images for the peers, orderes etc to test against

At this point the repo is fully ready for use and running tests, etc. A full sequence of build-test that is equivalent to the CI pipeline is

* `rush rebuild` will run the linting, and unit tests across the codebase, as well as building the docker images, and jsdoc API docs
* `rush start-verdaccio` & `rush stop-verdaccio` will start/stop verdaccio (used for local hosting of NPM modules)
* `rush start-fabric` & `rush stop-fabric` will start/stop the test fabric ready for running FV tests
* `rush test:fv` will run the fv tests, ensure that both the fabric and verdaccio have already been started
* `rush test:e2e` to run e2e tests across the repos

For more specific purposes during development the following are useful:

* `rush publish --include-all --pack --release-folder ./tarballs --publish`
If you want to get a set of `.tar.gz` files of the node modules to use for local testing this command will put them into the `tarballs` directory
* `rush rebuild --to fvtests` to run the unit tests for the core modules, but not the docker or jsdoc
* `rush rebuild --to fabric-contract-api` to build, lint and run just the `fabric-contract-api`
* `rush logs` will show the location of all the log files

To clean up docker

* `docker kill $(docker ps -q) && docker rm $(docker ps -aq)` will remove the running containers
* `docker rmi $(docker images 'dev-*' -q) --force` will remove the images for the chaincode containers

## Mechanics of Contributing

The codebase is maintained in [github](https://github.com/hyperledger/fabric-chaincode-node), with a CI pipeline run with [Azure Devlops](https://dev.azure.com/Hyperledger/Fabric-Chaincode-Node/_build?definitionId=33&_a=summary). Issues are handling in [Jira](https://jira.hyperledger.org/issues/?jql=project%20%3D%20FAB%20AND%20component%20%3D%20fabric-chaincode-node)   (please use the component `fabric-chaincode-node` in jira as this is shared project with other Fabric components).




## Code of Conduct Guidelines <a name="conduct"></a>

See our [Code of Conduct Guidelines](../blob/main/CODE_OF_CONDUCT.md).

## Maintainers <a name="maintainers"></a>

Should you have any questions or concerns, please reach out to one of the project's [Maintainers](../blob/main/MAINTAINERS.md).

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.
