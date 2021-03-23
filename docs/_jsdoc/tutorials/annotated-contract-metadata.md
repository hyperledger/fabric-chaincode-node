
# Annotated Contract Metadata

The Contract Metadata can be supplied either by the Contract developer or it can be inferred from the source code. Depending on the source language used, and the amount of annotations (if permitted by the language) you may need to augment the metadata that is generated.

## Metadata Schema

The metadata itself is in JSON, and there is a JSON-Schema definition that defines the contents; this schema is available online at https://hyperledger.github.io/fabric-chaincode-node/main/api/contract-schema.json

This is the latest ga copy of the schema. Specific version can be obtained using urls https://hyperledger.github.io/fabric-chaincode-node/{release}/api/contract-schema.json where releases matches the release name, for example
`main` `release-1.4`. Note that metadata was first introduced at v1.4.

A lot of the elements of this metadata are heavily inspired from the [OpenAPI v3.0 specification](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md) and [JSON Schema](http://json-schema.org/)

Adding a reference at the top of the metadata file to this schema, permits editors and tools to be able to perform validation on the JSON at the point of editing.

```json
{
    "$schema": "https://hyperledger.github.io/fabric-chaincode-node/main/api/contract-schema.json",

}
```

If within the contract metadata is supplied, then this will be validated against the schema (even if the `$schema` field is not set). If this fails then the instantiating of the contract will fail.


## Supplying your own metadata
If you wish to supply your own metadata, the following rules apply

- it must be in a file called `metadata.json`
- this must be in a directory called `META-INF` (alternatively, it can be in the `contract-metadata` directory as well)
- this directory must be a peer of the package.json file of your contract

`metadata.json` primarily should be supplied in `META-INF` directory, but if it's not found in `META-INF`, it will be checked for in the `contract-metadata` directory.

Depending on the language and implementation, you may only need to augment the metadata. For example, with Typescript the types of arguments can be derived. Typically a full 'info' section may be the only thing that needs augmenting. Therefore it is not required to specific all elements of the metadata

The metadata consists of three top level objects, 'info' 'contracts' and 'components'; you can supply all or none of these elements. (Supplying none is not considered an error, but has no practical effect)

The contents of each of these top level elements in your own metadata are used _in preference_ to any that can be automatically inferred.

_*It is a programming error to have logical inconsistencies between the 'contracts' and 'components' section.This could arise in the cases where the 'contracts' you specified is different from the automatically created 'components' section*_


## Overall structure

The metadata consists of three top level objects, 'info' 'contracts' and 'components'

### Info

*Purpose:*

To represent information about all the contracts defined in this chaincode module.

*Full Example:*
```json
  "info": {
    "title": "Commercial Paper Smart Contract",
    "description": "Smart Contract definitions for Commercial Paper, issuing and trading",
    "termsOfService": "http://example.com/terms/",
    "contact": {
      "name": "Peso Phillips",
      "url": "http://www.example.com/support",
      "email": "peso.phillips@example.com"
    },
    "license": {
      "name": "Apache 2.0",
      "url": "http://www.apache.org/licenses/LICENSE-2.0.html"
    },
    "version": "1.0.1"
  }
```

*Minimal Example:*
```json
  "info": {
    "title": "Commercial Paper Smart Contract",
    "version": "1.0.1"
  }
```

*Structure:*

This has exactly the same elements, and requirements as OpenAPI's [info object](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md#infoObject).  


### Contracts

*Purpose:*

This represents each contract class.

So for example the contracts object could be

```json
"contracts": {
    "initUpgrade": {
        ...
    },
    "purchasing":{
        ...
    },
    "query": {
        ...
    }
}
```
### Contract Object

*Purpose:*

Individual Contract object

*Structure:*

Each contract object has the following structure

```json
"CommercialPaper":{
    "name": "CommercialPaper",
    "info": {
        ...
    },
    "transactions":[
        ...
    ]
}
```

The name is the name of the contract, and is also the key value of the object. 'info' is the same OpenAPI info object as used at the top level of the metadata. It is not expected that the full form of this will be used with individual contracts.

Each 'transaction' represents the transaction functions within the contract (and will map, therefore, to a specific function in the code).

A starting example is a very simple transaction function.

```json
        "transactions": [
          {
            "name": "setGreetingText",
            "tag": [
              "SUBMIT", "submitTx"
            ],
            "parameters": [
              {
                "name": "text",
                "description": "",
                "schema": {
                  "type": "string"
                }
              },
              {
                "name": "value",
                "schema": {
                  "$ref": "#/components/schemas/Greeting"            
                }
              }
            ]

          }
        ]
```

- the name of the function is 'setGreetingText'
- it has tags of 'SUBMIT' and 'submitTx' that means that this transaction is intended to be submitted with the 'submitTransaction' sdk function. The implication is that this is then submitted to the orderder.  If this is not present, then the function will be 'evaluated', not submitted to the order so in effect a query-style operation.
- the parameters of the function are defined in 'parameters' as an array of parameter definitions. (each of which follows the [parameterObject](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#parameterObject) of OpenAPI)
- typically a parameter will contain a 'name', optional 'description' and critically the 'schema'
- again 'schema' comes from OpenAPI [schemaObject](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#schemaObject)
- In this example, there are two parameters one is a simple string, and the schema uses type to refer to this simply

```json
    "schema": {
        "type": "string"
    }
```

Where as the second uses the concept of references to permit a more complex object definition.

### Components

This section defines the more complex components that can occur in functions. This is typicaly used to represent objects or similar in the contract. They are generated for example from the `@object` annotation.

In the above example, the schema is defined as
```json
    "schema": {
        "$ref": "#/components/schemas/Greeting"            
    }
```

The `#/components/schemas/Greeting` is a JSON pointer to the following element:
```json

    "components": {
      "schemas": {
        "Greeting": {
          "$id": "Greeting",
          "type": "object",
          "additionalProperties": false,
          "properties": [
            {
              "name": "text",
              "schema": {
                "type": "string"
              }
            }
          ]
        }
      }
    }

```

### Schema validation

The `schemas` section is an object listing the schemas (the key and $id element match).
Each of these has the specification from the OpenAPI [schemaObject](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#schemaObject)

At runtime, any object that is supplied as one of the parameters matching a defined schema (in this case the Greeting object), has to match this supplied schema. The 'serializer' within the contract-api will produce a JSON representation of the object that is validated against this schema.

In this case for example, only the field 'text' is permitted - as additionalProperties is false. And has to be a string.

An other example would be to have a numeric value and limit its range.

```json
    "age": {
      "type": "integer",
      "format": "int32",
      "minimum": 0
    }
```

Individual elements of an object can refer to other objects for example, and the overall object can define required fields.

This example is defining the concept of a person; who has a name, address and an age.

- The name is mandatory and has to exist,
- additional properties not listed here will be accepted.
- The address is defined elsewhere, and the age has to be at least 0

```json
"person" : {
  "$id":"person",  
  "type": "object",
  "required": [
    "name"
  ],
  "properties": {
    "name": {
      "type": "string"
    },
    "address": {
      "$ref": "#/components/schemas/Address"
    },
    "age": {
      "type": "integer",
      "format": "int32",
      "minimum": 0
    }
  }
}
```
## String and Number validation

Strict semantic checking can be performed on strings and numbers. As an example consider this extract of metadata describing the parameters of a function
```
  "parameters": [
      {
          "name": "pupilName",
          "description": "",
          "required": true,
          "schema": {
              "type": "string"
          }
      },
      {
          "name": "formId",
          "description": "",
          "required": true,
          "schema": {
              "type": "string",
              "pattern": "^[a-zA-Z0-9]+$"
          }
      },
      {
          "name": "description",
          "description": "",
          "required": true,
          "schema": {
              "type": "string",
              "maxLength": 100
          }
      },
      {
          "name": "lifetime",
          "description": "days this is valid for (30 if not given)",
          "required": false,
          "schema": {
              "type": "integer",
              "minimum": 1,
              "maximum": 30
          }
      },
      {
          "name": "startDate",
          "description": "Start date yyyy-mm-dd, today if not specified",
          "required": false,
          "schema": {
              "type": "string",
              "format": "date"
          }
      }
  ]
```

**Note: The `required` tag at present is not enforced by the node chaincode.**

- __Pupilname__ this is a string, but has no restrictions placed up on it.
- __formId__ a string, but has to matched the regular expression. In this case it has to be exactly composed of lower or upcase letters and numbers
- __description__ a string, with the restriction that it can't be more than 100 characters in length
- __lifetime__ an integer with minimum value of 1 and maxiomum of 30
- __startDate__ an string but has to contain a date (As defined by full-date - [RFC3339](http://xml2rfc.ietf.org/public/rfc/html/rfc3339.html#anchor14)).  

The alternative to `format:date` is `format:dateTime` ... the string here has to confirmed to date-time defined in [RFC3339](http://xml2rfc.ietf.org/public/rfc/html/rfc3339.html#anchor14)
