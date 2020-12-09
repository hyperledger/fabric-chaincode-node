# Summary of the Typescript Decorators

When using Typescript to code the Contract implementations, Typescript Decorators can be used to provide additional metadata; together with the type information that can be introspected, a very detailed set of metadata can be put within the source code directly.

## Decorators available

- @Info
  - Supplies information about the following contract such as license terms or author.
  - This takes as a parameter an object that has the key-value pairs as defined on the OpenAPI v3 [Info object spec](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#infoObject)
- @Transaction
  - Defines the following function to be a callable transaction function
  - Takes a boolean parameter; true indicates that this function is intended to be called with the 'submit' semantics, false indicates that this is intended to be called with the evaluate semantics.  (Submit means submit to the orderer to be recorded on the ledger)
  - Default is true
- @Returns
  - Takes a string that is the name of the type that is being returned by this function
  - This is present as required as Typescript does not give back the complete return type
- @Object
  - Defines the class that represents one of the complex types that can be returned or passed to the transaction functions
- @Property
  - Defines a property of the a class (identified by @Object) that should be passed within the object
- @Param
  - Permits additional information such as a type and description to provided for parameters. (Note type is only useful in weakly typed languages)

**Note that emitDecoratorMetadata property in *tsconfig.json* file is mandatory.**
