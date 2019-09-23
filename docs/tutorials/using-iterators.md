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

These api's are a request to return a set of data for which you need to iterate over using the provided iterator. Some of these apis will return the iterator directly and others return an iterator as part of an object property. In previous versions of the fabric-shim api you would need to know which ones did that and handle it appropriately and you need to check the documentation, but the rules are
- all private data range queries return an object with just an iterator property containing the iterator
- all Pagination queries return an object with an iterator property and metadata property
- all other rich/range/history queries return just the iterator itself.

These iterators are essentially asynchronous iterators (the next and close methods returned promises) but you couldn't use standard iterator capabilities such as for/of constructs in node because node could not work with the concept of asynchronous iterators.

## How to use
The following shows an example of how to use the iterators

```javascript
async function getAllResults(iterator) {
    const allResults = [];
    while (true) {
        const res = await iterator.next();
        if (res.value) {
            // if not a getHistoryForKey iterator then key is contained in res.value.key
            allResults.push(res.value.value.toString('utf8'););
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
    is_delete: boolean;
    value: ProtobufBytes;
    timestamp: Timestamp;
    tx_id: string;
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

## example of getHistoryForKey
All the functions that return a set of data, except one, return data in the KV structure format. The exception is getHistoryForKey whose dataset is of the form KeyModification. Below is a simple example of using getHistoryForKey.

```javascript
const promiseOfIterator = ctx.stub.getHistoryForKey(key);

const results = [];
for await (const keyMod of promiseOfIterator) {
    const resp = {
        timestamp: keyMod.timestamp,
        txid: keyMod.tx_id
    }
    if (keyMod.is_delete) {
        resp.data = 'KEY DELETED';
    } else {
        resp.data = keyMod.value.toString('utf8');
    }
    results.push(resp);
}
// results array contains the key history
```