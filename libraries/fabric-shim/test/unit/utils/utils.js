const chai = require('chai');
const expect = chai.expect;

const utils = require('../../../lib/utils/utils');

describe('utils', () => {
    describe('generateLoggingPrefix', () => {
        it ('should shorten txids over 8 letters', () => {
            expect(utils.generateLoggingPrefix('myc', '123456789')).to.deep.equal('[myc-12345678]');
        });

        it ('should leave txids shorter than 8 as was', () => {
            expect(utils.generateLoggingPrefix('myc', '1234567')).to.deep.equal('[myc-1234567]');
        });

        it ('should leave txids exactly 8 letters as was', () => {
            expect(utils.generateLoggingPrefix('myc', '12345678')).to.deep.equal('[myc-12345678]');
        });
    });
});