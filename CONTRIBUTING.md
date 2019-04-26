## Contributing

We welcome contributions to the Hyperledger Fabric Project in many forms, and
there's always plenty to do!

Please visit the
[contributors guide](http://hyperledger-fabric.readthedocs.io/en/latest/CONTRIBUTING.html) in the
docs to learn how to make contributions to this exciting project.

## Code of Conduct Guidelines <a name="conduct"></a>

See our [Code of Conduct Guidelines](../blob/master/CODE_OF_CONDUCT.md).

## Maintainers <a name="maintainers"></a>

Should you have any questions or concerns, please reach out to one of the project's [Maintainers](../blob/master/MAINTAINERS.md).

<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons License" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br />This work is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.

## Running FV tests
The full FV suite can be run by using the following gulp targets.

- `channel-init` will start a very simple development fabric topology
- `test-e2e` will run all three sets of fv tests, each of which can be run separately

At this point in time, to rerun the tests, fabric must the restarted using the `channel-init` target


`start-fabric` can be used instead of `channel-init`
```
gulp channel-init
gulp test-e2e
# will run all three sets can be run separately
gulp test-fv-shim
gulp test-e2e-shim
gulp test-scenario
```
