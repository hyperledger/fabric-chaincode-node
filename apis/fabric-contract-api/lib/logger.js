/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/
'use strict';

const winston = require('winston');
const loggers = {};
const SPLAT = Symbol.for('splat');
const util = require('util');
const safeStringify = require('fast-safe-stringify');
// looks odd, but this is the most efficient way of padding strings in js
const padding = '                                               ';

// define the formatter for Winston
// this is aimed at being a singleton
const formatter = name => winston.format.combine(
    winston.format.timestamp(),
    winston.format.metadata({fillExcept: ['message', 'level', 'timestamp', 'label']}),
    winston.format.colorize(),
    winston.format.padLevels(),
    winston.format.printf((info) => {
        const {timestamp, level, message} = info;
        const str = (`[c-api:${name}]` + padding).substring(0, padding.length);
        let out = '';
        if (info[SPLAT]) {
            out = info[SPLAT].map(e => {
                if (e && e.error) {
                    if (e.error.stack) {
                        return e.error.stack;
                    } else {
                        return e.error.message;
                    }
                } else {
                    return safeStringify(e);
                }
            });
        }
        return `${timestamp} ${level} ${str} ${message} ${out} `;
    }
    )
);

// a console based transport, again a singleton
let transport;
const getTransport = () => {
    if (!transport) {
        transport = new winston.transports.Console({
            handleExceptions: false,
        });
    }
    return transport;
};

// create a logger
// there is no hierachy or split of loggers; one for future versions
function createLogger (loglevel, name) {
    const logger = new winston.createLogger({
        level: loglevel,
        format: formatter(name),
        transports: [
            getTransport()
        ],
        exitOnError: false
    });
    return logger;
}

// map the Hyperledger Fabric standard strings to the matching Winston ones
const levelMapping = (level) => {
    let loglevel = 'info';
    if (typeof level === 'string') {
        switch (level.toUpperCase()) {
            case 'CRITICAL':
                loglevel = 'fatal';
                break;
            case 'ERROR':
                loglevel = 'error';
                break;
            case 'WARNING':
                loglevel = 'warn';
                break;
            case 'DEBUG':
                loglevel = 'debug';
                break;
            case 'INFO':
                loglevel = 'info';
        }
    }
    return loglevel;
};

// Exported function to get the logger for a given name
module.exports.getLogger = function (name = '') {
    // set the logging level based on the environment variable
    // configured by the peer
    const loglevel = levelMapping(process.env.CORE_CHAINCODE_LOGGING_LEVEL);
    let logger;

    if (loggers[name]) {
        logger = loggers[name];
        logger.level = loglevel;
    } else {
        logger = createLogger(loglevel, name);
        loggers[name] = logger;
    }

    return logger;
};

// Specifically set the logging level
module.exports.setLevel = (level) => {
    // set the level of all the loggers currently active
    const loglevel = levelMapping(level);
    process.env.CORE_CHAINCODE_LOGGING_LEVEL = loglevel;

    Object.keys(loggers).forEach((name) => {
        loggers[name].level = loglevel;
    });
};


// This function is intended for once only use; it will setup a logger
// that will response to the unhanldedExceptions and the unhandledRejections
// Having too many transports that have handleExceptions = true results in
// node warnings about memory leaks.
function firstTime () {
    if (!loggers._) {
        const loglevel = levelMapping(process.env.CORE_CHAINCODE_LOGGING_LEVEL);
        loggers._ = new winston.createLogger({
            level: loglevel,
            format: formatter('_'),
            transports: [
                new winston.transports.Console({
                    handleExceptions: true,
                })
            ],
            exitOnError: false
        });

        if (!process.listeners('unhandledRejection').some(e => e.name === 'loggerUnhandledRejectionFn')) {
            const loggerUnhandledRejectionFn = (reason, p) => {
                loggers._.error('Unhandled Rejection reason ' + reason + ' promise ' + util.inspect(p));
            };
            process.on('unhandledRejection', loggerUnhandledRejectionFn);
        }

    }
}
firstTime();