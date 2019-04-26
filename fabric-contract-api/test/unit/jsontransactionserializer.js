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

        it('should create plain object ok', () => {
            const sc0 = new JSONSerializer();
            sc0.should.be.an.instanceOf(JSONSerializer);
        });

    });

    describe('#toBuffer', () => {

        it('should return undefined if nothing passed in (no schema) ', () => {
            const sc0 = new JSONSerializer();
            expect(sc0.toBuffer()).to.be.equal(undefined);
        });

        it('should return string from a string in result if schema given', () => {
            const sc0 = new JSONSerializer();
            expect(sc0.toBuffer('hello world', {type: 'string'})).to.deep.equal(Buffer.from('hello world'));
        });
        it('should return number from a number in result if schema given', () => {
            const sc0 = new JSONSerializer();
            expect(sc0.toBuffer(42, {type: 'number'})).to.deep.equal(Buffer.from('42'));
        });

        it('should throw an error if the type of data passed does not match schema given', () => {
            const sc0 = new JSONSerializer();
            (() => {
                sc0.toBuffer(42, {type: 'string'});

            }).should.throw(/Returned value is .* does not match schema type of .*/);
        });

        it('should handle booleans', () => {
            const sc0 = new JSONSerializer();
            expect(sc0.toBuffer(false)).to.deep.equal(Buffer.from('false'));
            expect(sc0.toBuffer(true)).to.deep.equal(Buffer.from('true'));
        });

        it('should return string from a string in result if JS can tell', () => {
            const sc0 = new JSONSerializer();
            expect(sc0.toBuffer('hello world')).to.deep.equal(Buffer.from('hello world'));
        });
        it('should return number from a number in result if JS can tell', () => {
            const sc0 = new JSONSerializer();
            expect(sc0.toBuffer(42, {type: 'number'})).to.deep.equal(Buffer.from('42'));
        });

        it('should handle generic object', () => {
            const sc0 = new JSONSerializer();
            const result = sc0.toBuffer({'real': 52, 'imaginary': 'sqrt(-1)'});
            expect(JSON.parse(result.toString('utf8'))).to.deep.equal({real: 52, imaginary: 'sqrt(-1)'});
        });


        it('should handle array of strings', () => {
            const sc0 = new JSONSerializer();
            const ducks = ['mallard', 'eider', 'mandarin'];
            const schema = {
                type: 'array',
                items: {
                    type: 'string'
                }
            };
            const result = sc0.toBuffer(ducks, schema);
            expect(result.toString('utf8')).to.equal('["mallard","eider","mandarin"]');

        });

        it('should handle array of objects', () => {
            const sc0 = new JSONSerializer();
            const duck = class Duck {
                constructor(name) {
                    this.name = name;
                }
                quack () {
                    return `${this.name} quack!`;
                }
            };

            const ducks = [];
            ducks.push(new duck('Mallard'), new duck('Eider'));
            const schema = {
                type: 'array',
                items: {
                    type: 'string'
                }
            };
            const result = sc0.toBuffer(ducks, schema);
            expect(result.toString('utf8')).to.equal('[{"name":"Mallard"},{"name":"Eider"}]');

        });



    });
    describe('#fromBuffer:obects', () => {
        it('Fully speced object', () => {

            const assetclass = class Asset { };
            const sc0 = new JSONSerializer();
            const schema = {
                properties: {
                    prop: {
                        '$ref': '#/components/schemas/Asset'
                    }
                },
                components: {
                    schemas: {
                        'State': {
                            '$id': 'State',
                            'type': 'object',
                            'properties': {}
                        },
                        'Asset': {
                            '$id': 'Asset',
                            'cnstr': assetclass.prototype.constructor,
                            'allOf': [
                                {
                                    'type': 'object',
                                    'properties': {
                                        'assetId': {
                                            'type': 'string'
                                        },
                                        'description': {
                                            'type': 'string'
                                        }
                                    }
                                },
                                {
                                    '$ref': 'State'
                                }
                            ]
                        }
                    }
                }
            };

            // call the buffer
            const testData = Buffer.from(JSON.stringify({'assetId': '12333', 'description': 'a thing'}));
            const obj = sc0.fromBuffer(testData, schema);
            expect(obj.value).to.deep.equal({assetId: '12333', description: 'a thing'});
            expect(obj.value instanceof assetclass.prototype.constructor).to.be.true;
        });

        it('Generic object - no type specificed', () => {

            const assetclass = class Asset { };
            const sc0 = new JSONSerializer();
            const schema = {
                properties: {
                    prop: {
                        '$ref': '#/components/schemas/Asset'
                    }
                },
                components: {
                    schemas: {
                        'State': {
                            '$id': 'State',
                            'type': 'object',
                            'properties': {}
                        },
                        'Asset': {
                            '$id': 'Asset',
                            'allOf': [
                                {
                                    'type': 'object',
                                    'properties': {
                                        'assetId': {
                                            'type': 'string'
                                        },
                                        'description': {
                                            'type': 'string'
                                        }
                                    }
                                },
                                {
                                    '$ref': 'State'
                                }
                            ]
                        }
                    }
                }
            };

            // call the buffer
            const testData = Buffer.from(JSON.stringify({'assetId': '12333', 'description': 'a thing'}));
            const obj = sc0.fromBuffer(testData, schema);
            expect(obj.value).to.deep.equal({assetId: '12333', description: 'a thing'});
            expect(obj.value instanceof assetclass.prototype.constructor).to.be.false;
        });
    });

    describe('#fromBuffer:primitives', () => {

        it('should throw an error if nothing given', () => {
            const sc0 = new JSONSerializer();
            (() => {
                sc0.fromBuffer();
            }).should.throw(/Buffer needs to be supplied/);
        });

        it('should throw an error if not a number', () => {
            const sc0 = new JSONSerializer();
            (() => {
                const schema = {
                    properties: {
                        prop: {
                            type: 'number'
                        }
                    },
                    components: {
                        schemas: {}
                    }
                };
                sc0.fromBuffer(Buffer.from('102345679a'), schema);
            }).should.throw(/fromBuffer could not convert data to number/);
        });

        it('should throw an error if bad boolean given', () => {
            const sc0 = new JSONSerializer();
            (() => {
                const schema = {
                    properties: {
                        prop: {
                            type: 'boolean'
                        }
                    },
                    components: {
                        schemas: {}
                    }
                };
                sc0.fromBuffer(Buffer.from('trie'), schema);
            }).should.throw(/fromBuffer could not convert data to boolean/);
        });

        it('should do cope with bad input and simply tostring if bad JSON used for non string or number type', () => {
            const sc0 = new JSONSerializer();

            const schema = {
                properties: {
                    prop: {
                        type: 'some type'
                    }
                },
                components: {
                    schemas: {}
                }
            };
            const result = sc0.fromBuffer(Buffer.from('trie'), schema);
            expect(result).to.deep.equal({value: 'trie', jsonForValidation: '"trie"'});

        });

        it('should handle specific String case', () => {
            const sc0 = new JSONSerializer();
            const schema = {
                properties: {
                    prop: {
                        type: 'string'
                    }
                },
                components: {
                    schemas: {}
                }
            };
            const v = sc0.fromBuffer(Buffer.from('HelloWorld'), schema);
            v.should.deep.equal({value: 'HelloWorld', jsonForValidation: JSON.stringify('HelloWorld')});
        });

        it('should handle specific Number case', () => {
            const sc0 = new JSONSerializer();
            const schema = {
                properties: {
                    prop: {
                        type: 'number'
                    }
                },
                components: {
                    schemas: {}
                }
            };
            const v = sc0.fromBuffer(Buffer.from('102345679'), schema);
            v.should.deep.equal({value: 102345679, jsonForValidation: 102345679});
        });

        it('should handle specific Boolean case', () => {
            const sc0 = new JSONSerializer();
            const schema = {
                properties: {
                    prop: {
                        type: 'boolean'
                    }
                },
                components: {
                    schemas: {}
                }
            };
            const v = sc0.fromBuffer(Buffer.from('true'), schema);
            v.should.deep.equal({value: true, jsonForValidation: true});

            const v1 = sc0.fromBuffer(Buffer.from('false'), schema);
            v1.should.deep.equal({value: false, jsonForValidation: false});

        });

        it('should handle specific Number case', () => {
            const sc0 = new JSONSerializer();
            const schema = {
                properties: {
                    prop: {
                        type: 'whatever'
                    }
                },
                components: {
                    schemas: {}
                }
            };
            const v = sc0.fromBuffer(Buffer.from(JSON.stringify({'wibble': 'wobble'})), schema);
            v.should.deep.equal({value: {'wibble': 'wobble'}, jsonForValidation: {'wibble': 'wobble'}});
        });

        it('should handle booleans', () => {
            const sc0 = new JSONSerializer();
            const schema = {
                properties: {
                    prop: {
                        type: 'whatever'
                    }
                },
                components: {
                    schemas: {}
                }
            };
            const v = sc0.fromBuffer(Buffer.from(JSON.stringify({'wibble': true, 'wobble': false})), schema);
            v.should.deep.equal({value: {'wibble': true, 'wobble': false}, jsonForValidation: {'wibble': true, 'wobble': false}});
        });

        it('should handle stuff that is really vague', () => {
            const sc0 = new JSONSerializer();
            const schema = {
                properties: {
                    prop: {

                    }
                },
                components: {
                    schemas: {}
                }
            };
            const v = sc0.fromBuffer(Buffer.from(JSON.stringify({'wibble': true, 'wobble': false})), schema);
            v.should.deep.equal({value: {'wibble': true, 'wobble': false}, jsonForValidation: {'wibble': true, 'wobble': false}});
        });

        it('should handle buffer that is really vague', () => {
            const sc0 = new JSONSerializer();
            const schema = {
                properties: {
                    prop: {

                    }
                },
                components: {
                    schemas: {}
                }
            };
            const v = sc0.fromBuffer(Buffer.from(JSON.stringify(Buffer.from('hello world'))), schema);
            v.should.deep.equal({
                value: Buffer.from('hello world'), jsonForValidation: JSON.parse(
                    Buffer.from(JSON.stringify(Buffer.from('hello world')))
                )
            });
        });

        it('should handle errors of unkown type', () => {
            const sc0 = new JSONSerializer();
            (() => {
                sc0.fromBuffer(Buffer.from(JSON.stringify({type: 'whatever'})));
            }).should.throw(/Schema has not been specified/);
        });


        it('should handle array of strings', () => {
            const sc0 = new JSONSerializer();
            const ducks = ['mallard', 'eider', 'mandarin'];
            const schema = {
                properties: {
                    prop: {
                        type: 'array',
                        items: {
                            type: 'string'
                        }
                    }
                }
            };

            const result = sc0.fromBuffer(Buffer.from(JSON.stringify(ducks)), schema);
            expect(result.value).to.an('array');

        });

        it('should handle array of objects', () => {
            const sc0 = new JSONSerializer();
            const duck = class Duck {
                constructor(name) {
                    this.name = name;
                }
                quack () {
                    return `${this.name} quack!`;
                }
            };

            const ducks = [];
            ducks.push(new duck('Mallard'), new duck('Eider'), new duck('Mandarin'));
            const schema = {
                properties: {
                    prop: {
                        type: 'array',
                        items: {
                            '$ref': '#/components/schemas/Duck'
                        }
                    }
                },
                components: {
                    schemas: {
                        'Duck': {
                            '$id':'Duck',
                            'type': 'object',
                            'properties': {
                                'name': {
                                    'type': 'string'
                                }

                            },
                            cnstr: duck
                        }
                    }
                }
            };
            const result = sc0.fromBuffer(Buffer.from(JSON.stringify(ducks)), schema);
            expect(result.value).to.be.a('array');
            expect(result.value.length).to.equal(3);
            expect(result.value[0].constructor.name).to.equal('Duck');
            expect(result.value[1].constructor.name).to.equal('Duck');
            expect(result.value[2].constructor.name).to.equal('Duck');

            expect(result.jsonForValidation).to.deep.equal([{name: 'Mallard'}, {name: 'Eider'}, {name: 'Mandarin'}]);
        });
    });

});
