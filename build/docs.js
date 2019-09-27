/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
/* eslint-disable no-console */
const {src, dest, series} = require('gulp');
const jsdoc = require('gulp-jsdoc3');
const fs = require('fs-extra');
const path = require('path');
const replace = require('gulp-replace');

let currentBranch = process.env.GERRIT_BRANCH || process.env.BUILD_SOURCEBRANCHNAME;

if (!currentBranch) {
    currentBranch = 'master';
}

let docsRoot;
if (process.env.DOCS_ROOT) {
    docsRoot = process.env.DOCS_ROOT;
} else {
    docsRoot = './docs/gen';
}

const docSrc = [
    'docs/README.md',
    'fabric-shim/lib/chaincode.js',
    'fabric-shim/lib/stub.js',
    'fabric-shim/lib/iterators.js',
    'fabric-contract-api/lib/**/*.js'
];

const _clean = (done) => {
    fs.removeSync(path.join(docsRoot, currentBranch));
    done();
};

const _schema_docs = () => {
    return src('fabric-contract-api/schema/contract-schema.json')
        .pipe(dest(path.join(docsRoot, currentBranch)));
};

const _jsdocs = (cb) => {
    src(docSrc, {read: false}).pipe(jsdoc({
        opts: {
            tutorials: './docs/tutorials',
            destination: path.join(docsRoot, currentBranch)
        },
        templates: {
            systemName: 'Hyperledger Fabric Node.js Contract and Shim',
            theme: 'cosmo'
        },

    }, cb)
    );
};

// for the rare occurance where something needs to be bootsrap in the docs ahead of a release
// const _bootstrap = () => {
//     return src('./docs/bootstrap/**/*').pipe(gulp.dest(docsRoot));
// };

const _docs = (done) => {
    const relativePath = '.';
    const packageJson = require(path.join(__dirname, '..', 'package.json'));
    let mapping = ['ClientIdentity',
        'ChaincodeFromContract',
        'CommonIterator',
        'ChaincodeInterface',
        'ChaincodeStub',
        'HistoryQueryIterator',
        'ChaincodeStub.SignedProposal',
        'Shim',
        'Meta',
        'StateQueryIterator'
    ];

    mapping = mapping.map((e) => {
        return `'${e}.html'`;
    });

    // jsdocs produced
    // if this is the master build then we need to ensure that the index.html and
    // the 404.html page are properly setup and configured.
    // also copies the
    if (currentBranch === 'master') {
        const pathToReleasedSchema = path.resolve(docsRoot, packageJson.docsLatestVersion, 'contract-schema.json');
        return src(['./docs/redirectTemplates/*.html', pathToReleasedSchema])
            .pipe(replace('LATEST__VERSION', packageJson.docsLatestVersion))
            .pipe(replace('FILENAME__MAPPING', mapping.join(',')))
            .pipe(replace('RELATIVE__PATH', relativePath))
            .pipe(dest(docsRoot));
    } else {
        console.log(`Not updating or routing logic, as not master branch - it is ${currentBranch}`);
        done();
    }
};


const jsdocs = series(_clean, _jsdocs);
const docs = series(jsdocs, _schema_docs, _docs);

exports.docs = docs;
