/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* global describe it beforeEach afterEach  */
'use strict';

const chai = require('chai');
chai.should();
const expect = chai.expect;
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
const sinon = require('sinon');

const path = require('path');
// class under test
const pathToRoot = '../../..';

const JSONSerializer = require(path.join(pathToRoot, 'fabric-contract-api/lib/jsontransactionserializer.js'));

describe('jsontransactionserializer.js', () => {

    let sandbox;

    beforeEach('Sandbox creation', () => {
        sandbox = sinon.createSandbox();
    });

    afterEach('Sandbox restoration', () => {
        sandbox.restore();
    });

    describe('#constructor', () => {

        it ('should create plain object ok', () => {
            const sc0 = new JSONSerializer();
            sc0.should.be.an.instanceOf(JSONSerializer);
        });

    });


    const data = [
        'HelloWorld',
        42,
        {text:'hello', value: {i:'root -1'}},
        Buffer.from('hello')
    ];

    const dataForValidation = [
        'HelloWorld',
        42,
        {text:'hello', value: {i:'root -1'}},
        Buffer.from('hello')
    ];

    const buffer = [];

    before(() => {
        data.forEach((e) => {
            buffer.push(Buffer.from(JSON.stringify(e)));
        });
    });

    describe('#toBuffer', () => {

        it ('should return undefined if nothing passed in (no schema) ', () => {
            const sc0 = new JSONSerializer();
            expect(sc0.toBuffer()).to.be.equal(undefined);
        });

        it ('should return stringifed result (no schema)', () => {
            const sc0 = new JSONSerializer();
            for (let i = 0; i < data.length; i++) {
                expect(sc0.toBuffer(data[i])).to.deep.equal(buffer[i]);
            }
        });

        it ('should return string from a string in result if schema given', () => {
            const sc0 = new JSONSerializer();
            expect(sc0.toBuffer('hello world', {type:'string'})).to.deep.equal(Buffer.from('hello world'));
        });
        it ('should return number from a number in result if schema given', () => {
            const sc0 = new JSONSerializer();
            expect(sc0.toBuffer(42, {type:'number'})).to.deep.equal(Buffer.from('42'));
        });

        it ('should throw an error if the type of data passed does not match schema given', () => {
            const sc0 = new JSONSerializer();
            (() => {
                sc0.toBuffer(42, {type:'string'});

            }).should.throw(/Returned value is .* does not match schema type of .*/);
        });

        it('should handle booleans', () => {
            const sc0 = new JSONSerializer();
            expect(sc0.toBuffer(false)).to.deep.equal(Buffer.from('false'));
            expect(sc0.toBuffer(true)).to.deep.equal(Buffer.from('true'));
        });
    });

    describe('#fromBuffer', () => {

        it ('should throw an error if nothing given', () => {
            const sc0 = new JSONSerializer();
            (() => {
                sc0.fromBuffer();
            }).should.throw(/Buffer needs to be supplied/);
        });

        it ('should throw an error if not a number', () => {
            const sc0 = new JSONSerializer();
            (() => {
                sc0.fromBuffer(Buffer.from('102345679a'), {type:'number'});
            }).should.throw(/fromBuffer could not convert data to number/);
        });

        it ('should throw an error if bad boolean given', () => {
            const sc0 = new JSONSerializer();
            (() => {
                sc0.fromBuffer(Buffer.from('trie'), {type:'boolean'});
            }).should.throw(/fromBuffer could not convert data to boolean/);
        });

        it ('should throw an error if bad JSON used for non string or number type', () => {
            const sc0 = new JSONSerializer();
            (() => {
                sc0.fromBuffer(Buffer.from('trie'), {type:'some type'});
            }).should.throw(/fromBuffer could not parse data as JSON to allow it to be converted to type: "some type"/);
        });

        it ('should return inflated data from the buffer', () => {
            const sc0 = new JSONSerializer();
            for (let i = 0; i < data.length; i++) {
                expect(sc0.fromBuffer(buffer[i])).to.deep.equal({value: data[i], jsonForValidation: dataForValidation[i]});
            }
        });

        it('should handle specific String case', () => {
            const sc0 = new JSONSerializer();
            const v = sc0.fromBuffer(Buffer.from('HelloWorld'), {type:'string'});
            v.should.deep.equal({value:'HelloWorld', jsonForValidation:JSON.stringify('HelloWorld')});
        });

        it('should handle specific Number case', () => {
            const sc0 = new JSONSerializer();
            const v = sc0.fromBuffer(Buffer.from('102345679'), {type:'number'});
            v.should.deep.equal({value:102345679, jsonForValidation:102345679});
        });

        it ('should handle specific Boolean case', () => {
            const sc0 = new JSONSerializer();
            const v = sc0.fromBuffer(Buffer.from('true'), {type:'boolean'});
            v.should.deep.equal({value:true, jsonForValidation:true});
        });

        it('should handle specific Number case', () => {
            const sc0 = new JSONSerializer();
            const v = sc0.fromBuffer(Buffer.from(JSON.stringify({'wibble':'wobble'})), {type:'whatever'});
            v.should.deep.equal({value:{'wibble':'wobble'}, jsonForValidation:{'wibble':'wobble'}});
        });

        it('should handle booleans', () => {
            const sc0 = new JSONSerializer();
            const v = sc0.fromBuffer(Buffer.from(JSON.stringify({'wibble':true, 'wobble':false})), {type:'whatever'});
            v.should.deep.equal({value:{'wibble':true, 'wobble':false}, jsonForValidation:{'wibble':true, 'wobble':false}});
        });

        it ('should handle errors of unkown type', () => {
            const sc0 = new JSONSerializer();
            (() => {
                sc0.fromBuffer(Buffer.from(JSON.stringify({type:'whatever'})));
            }).should.throw(/Type of whatever is not understood, can't recreate data/);
        });
    });

});
