/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const {Context} = require('fabric-contract-api');

class ScenarioContext extends Context {

    constructor() {
        super();
    }


    generateKey() {
        return this.stub.createCompositeKey('type', ['keyvalue']);
    }

}

module.exports = ScenarioContext;
