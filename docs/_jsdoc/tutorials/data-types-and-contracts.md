# How are data types handling with Contracts?
This document deals with JavaScript and TypeScript contracts

## Function parameters

### JavaScript - no metadata

This is the lowest common denominator; all data that is sent to the transaction function from the client is represented as strings. 
Therefore the conversion that takes place in the lack of any metadata is 

```
json = JSON.parse(data.toString());
```

If the json has a property of 'type' and that equals 'Buffer' then a byte buffer is constructed. The standard JSON.stringify() form of a byte buffer is to add the type field.

It is then left to JavaScript to be able to coerce the data as per standard language rules

### JavaScript - with metadata

If the metadata for the property specifies a String or a Number, then conversion to a String or Number takes place. 
Otherwise, the same conversion takes place as with 'no-metadata'


### Typescript
Typescript needs to have no annotations for types, (other than arrays).  The metadata is inferred with sufficient detail.
For arrays, the `@Param(<name>,<array type>,[<description>])` needs to be used to mark the type that is in the array.


## Return types

A transaction function is free to return anything it wishes. (Strictly speaking it must return a promise, and that can be resolved or rejected with anything).  

With the Node.js runtime, either JavaScript or TypeScript can be used. For both languages you can supply additional metadata, either as annotations, or as a JSON file. 

### JavaScript - no metadata

This is the lowest common denominator; if no metadata is either provided by annotations, file, or inferred by introspection this is behaviour. 
All return values will be processed as follows:

```javascript
Buffer.from(JSON.stringify(functionsReturnValue))
```

The data will be stringified, then converted to a buffer to be returned. The buffer conversion is required by the shim api to communicate with the peer. This will be 'reversed' in the client SDK so that clients are given a string. 

### JavaScript with metadata

It is beneficial to supply metadata; specifically in the case of JavaScript to identify strings and numbers from objects. 

By doing this means that the transaction functions can 

- Return strings and numbers directly. Numbers are converted to their textual form eg  42 becomes "42"
- Anything else is returned by being stringified first

## Typescript

Without the '@return' annotations and/or metadata Typescript introspection can not provide enough details about the return type. Primarily as this is a Promise that resolves a type introspection only indicates the promise aspect.

Metadata can be explicitly provided or the `@Returns(<string of type name>)` can be used to indicate the type.  The annotation needs to have the type name specified as a string value. 



