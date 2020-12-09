# Working with iterators
The fabric-shim api provides capability to retrieve blocks of information. Information such as the history of a key, a set of keys and their values from a range of keys and also a set of keys and values when performing a rich query if your network is using couchdb to manage the world state.

An example of these apis (but may not be a complete list) is given here

- History
  -	getHistoryForKey
- Private data
  -	getPrivateDataByPartialCompositeKey
  -	getPrivateDataByRange
  -	getPrivateDataQueryResult
- Rich query
  - getQueryResult
  - getQueryResultWithPagination 
- Range queries 
  - getStateByPartialCompositeKey
  -	getStateByPartialCompositeKeyWithPagination
  - getStateByRange
  - getStateByRangeWithPagination

These apis are a request to return a set of data for which you need to iterate over using the provided iterator. Some of these apis will return the iterator directly and others return an iterator as part of an object property. In previous versions of the fabric-shim api you would need to know which ones did that and handle it appropriately and you need to check the documentation, but the rules are
- all private data range queries return an object with just an iterator property containing the iterator
- all Pagination queries return an object with an iterator property and metadata property
- all other rich/range/history queries return just the iterator itself.

These iterators were essentially asynchronous iterators (the next and close methods returned promises) but you couldn't use standard iterator capabilities such as for/of constructs in node because node could not work with the concept of asynchronous iterators.

From fabric v2.x onwards, node chaincode will be using node 12 and this has added support for asynchronous iterators. Also in fabric v2.x onwards, fabric-shim has added support to enable it's asynchronous iterators so that `for/of` can now be used, but note that they don't have full support, so should not be used in generator functions.

As a comparison, let's present first how you would use iterators in previous releases and then show the new way.

## How to use, the old way
In the past, you might have coded something like this to process an iterator:

```javascript
async function getAllResults(iterator) {
    const allResults = [];
    while (true) {
        const res = await iterator.next();
        if (res.value) {
            // if not a getHistoryForKey iterator then key is contained in res.value.key
            allResults.push(res.value.value.toString('utf8'));
        }

        // check to see if we have reached then end
        if (res.done) {
            // explicitly close the iterator            
            await iterator.close();
            return allResults;
        }
    }
}
```
as iterator.next() returned an object of the form
```javascript
{value: KV|KeyModification object
 done: true|false}
```

and the structures of the value property are best described by the typescript definitions

```javascript
interface KV {
    key: string;
    value: Buffer;
    getKey(): string;
    getValue(): ProtobufBytes;
}

interface KeyModification {
    isDelete: boolean;
    value: ProtobufBytes;
    timestamp: Timestamp;
    txId: string;
    getIsDelete(): boolean;
    getValue(): ProtobufBytes;
    getTimestamp(): Timestamp;
    getTxId(): string;
}
```

and you would obtain an iterator as follows (depending on the api you are calling)

```javascript
// use await to get the iterator and pass it to getAllResults
const iterator = await ctx.stub.getStateByRange(startKey, endKey);
let results await getAllResults(iterator);

// use await to get the object containing the iterator and metadata and
// pass it to getAllResults. All Pagination type queries return an object
// with iterator and metadata properties
let response = await ctx.stub.getQueryResultWithPagination(JSON.stringify(query), 2);
const {iterator, metadata} = response;
let results = await getAllResults(iterator);

// use await to get the object containing the iterator and metadata and
// pass it to getAllResults. All Private Data type queries return an object
// with only an iterator property
let response = await ctx.stub.getPrivateDataByRange(collection, startKey, endKey);
let results = await getAllResults(response.iterator);
```

## How to use, the new way
The new way of using `for/await/of` in node.js makes things much easier. You don't have to worry about each of the api's returning a different value (is it an iterator or is it an object with an iterator in the iterator property). You also don't have to explicitly close the iterator any more. Here is a re-implementation of the `getAllResults` function

```javascript
async function getAllResults(promiseOfIterator) {
    const allResults = [];
    for await (const res of promiseOfIterator) {
        // no more res.value.value ...
        // if not a getHistoryForKey iterator then key is contained in res.key
        allResults.push(res.value.toString('utf8'));
    }

    // iterator will be automatically closed on exit from the loop
    // either by reaching the end, or a break or throw terminated the loop
    return allResults;
}
```
It's more concise, the only difference between the 2 signatures of the old versus the new is what you pass to it. Previously you passed the actual iterator but in the new version you pass the promise that will resolve to either an iterator or an object containing the iterator. So if we take the 3 previous calls to the various apis, how do they look now.

```javascript
// use await to get the iterator and pass it to getAllResults
const promiseOfIterator = ctx.stub.getStateByRange(startKey, endKey);
let results await getAllResults(promiseOfIterator);

// use await to get the object containing the iterator and metadata and
// pass it to getAllResults. All Pagination type queries return an object
// with iterator and metadata properties
let promiseOfIterator = ctx.stub.getQueryResultWithPagination(JSON.stringify(query), 2);
let results = await getAllResults(promiseOfIterator);
const metadata = (await promiseOfIterator).metadata;

// use await to get the object containing the iterator and metadata and
// pass it to getAllResults. All Private Data type queries return an object
// with only an iterator property
let promiseOfIterator = ctx.stub.getPrivateDataByRange(collection, startKey, endKey);
let results = await getAllResults(promiseOfIterator);
```
Lets note the differences
1. You do not use `await` when invoking the stub function. This means it will return a promise
2. You don't have to worry about whether the promise will resolve to an iterator or an object containing the iterator. The returned value is handled in the same way in all cases
3. In the case of pagination apis it's still easy to get the required metadata response.

## example of getHistoryForKey
All the functions that return a set of data, except one, return data in the KV structure format. The exception is getHistoryForKey whose dataset is of the form KeyModification. Below is a simple example of using getHistoryForKey.

```javascript
const promiseOfIterator = ctx.stub.getHistoryForKey(key);

const results = [];
for await (const keyMod of promiseOfIterator) {
    const resp = {
        timestamp: keyMod.timestamp,
        txid: keyMod.txId
    }
    if (keyMod.isDelete) {
        resp.data = 'KEY DELETED';
    } else {
        resp.data = keyMod.value.toString('utf8');
    }
    results.push(resp);
}
// results array contains the key history
```

