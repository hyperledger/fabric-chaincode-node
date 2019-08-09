/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

/* global describe it */

const shim = require('../../../fabric-shim/lib/chaincode.js');

const chai = require('chai');
const expect = chai.expect;

const certWithoutAttrs = '-----BEGIN CERTIFICATE-----' +
'MIICXTCCAgSgAwIBAgIUeLy6uQnq8wwyElU/jCKRYz3tJiQwCgYIKoZIzj0EAwIw' +
'eTELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNh' +
'biBGcmFuY2lzY28xGTAXBgNVBAoTEEludGVybmV0IFdpZGdldHMxDDAKBgNVBAsT' +
'A1dXVzEUMBIGA1UEAxMLZXhhbXBsZS5jb20wHhcNMTcwOTA4MDAxNTAwWhcNMTgw' +
'OTA4MDAxNTAwWjBdMQswCQYDVQQGEwJVUzEXMBUGA1UECBMOTm9ydGggQ2Fyb2xp' +
'bmExFDASBgNVBAoTC0h5cGVybGVkZ2VyMQ8wDQYDVQQLEwZGYWJyaWMxDjAMBgNV' +
'BAMTBWFkbWluMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEFq/90YMuH4tWugHa' +
'oyZtt4Mbwgv6CkBSDfYulVO1CVInw1i/k16DocQ/KSDTeTfgJxrX1Ree1tjpaodG' +
'1wWyM6OBhTCBgjAOBgNVHQ8BAf8EBAMCB4AwDAYDVR0TAQH/BAIwADAdBgNVHQ4E' +
'FgQUhKs/VJ9IWJd+wer6sgsgtZmxZNwwHwYDVR0jBBgwFoAUIUd4i/sLTwYWvpVr' +
'TApzcT8zv/kwIgYDVR0RBBswGYIXQW5pbHMtTWFjQm9vay1Qcm8ubG9jYWwwCgYI' +
'KoZIzj0EAwIDRwAwRAIgCoXaCdU8ZiRKkai0QiXJM/GL5fysLnmG2oZ6XOIdwtsC' +
'IEmCsI8Mhrvx1doTbEOm7kmIrhQwUVDBNXCWX1t3kJVN' +
'-----END CERTIFICATE-----';

const certWithAttrs = '-----BEGIN CERTIFICATE-----' +
'MIIB6TCCAY+gAwIBAgIUHkmY6fRP0ANTvzaBwKCkMZZPUnUwCgYIKoZIzj0EAwIw' +
'GzEZMBcGA1UEAxMQZmFicmljLWNhLXNlcnZlcjAeFw0xNzA5MDgwMzQyMDBaFw0x' +
'ODA5MDgwMzQyMDBaMB4xHDAaBgNVBAMTE015VGVzdFVzZXJXaXRoQXR0cnMwWTAT' +
'BgcqhkjOPQIBBggqhkjOPQMBBwNCAATmB1r3CdWvOOP3opB3DjJnW3CnN8q1ydiR' +
'dzmuA6A2rXKzPIltHvYbbSqISZJubsy8gVL6GYgYXNdu69RzzFF5o4GtMIGqMA4G' +
'A1UdDwEB/wQEAwICBDAMBgNVHRMBAf8EAjAAMB0GA1UdDgQWBBTYKLTAvJJK08OM' +
'VGwIhjMQpo2DrjAfBgNVHSMEGDAWgBTEs/52DeLePPx1+65VhgTwu3/2ATAiBgNV' +
'HREEGzAZghdBbmlscy1NYWNCb29rLVByby5sb2NhbDAmBggqAwQFBgcIAQQaeyJh' +
'dHRycyI6eyJhdHRyMSI6InZhbDEifX0wCgYIKoZIzj0EAwIDSAAwRQIhAPuEqWUp' +
'svTTvBqLR5JeQSctJuz3zaqGRqSs2iW+QB3FAiAIP0mGWKcgSGRMMBvaqaLytBYo' +
'9v3hRt1r8j8vN0pMcg==' +
'-----END CERTIFICATE-----';

const certWithLongDNs = '-----BEGIN CERTIFICATE-----' +
'MIICGjCCAcCgAwIBAgIRAIPRwJHVLhHK47XK0BbFZJswCgYIKoZIzj0EAwIwczEL' +
'MAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNhbiBG' +
'cmFuY2lzY28xGTAXBgNVBAoTEG9yZzIuZXhhbXBsZS5jb20xHDAaBgNVBAMTE2Nh' +
'Lm9yZzIuZXhhbXBsZS5jb20wHhcNMTcwNjIzMTIzMzE5WhcNMjcwNjIxMTIzMzE5' +
'WjBbMQswCQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEWMBQGA1UEBxMN' +
'U2FuIEZyYW5jaXNjbzEfMB0GA1UEAwwWVXNlcjFAb3JnMi5leGFtcGxlLmNvbTBZ' +
'MBMGByqGSM49AgEGCCqGSM49AwEHA0IABBd9SsEiFH1/JIb3qMEPLR2dygokFVKW' +
'eINcB0Ni4TBRkfIWWUJeCANTUY11Pm/+5gs+fBTqBz8M2UzpJDVX7+2jTTBLMA4G' +
'A1UdDwEB/wQEAwIHgDAMBgNVHRMBAf8EAjAAMCsGA1UdIwQkMCKAIKfUfvpGproH' +
'cwyFD+0sE3XfJzYNcif0jNwvgOUFZ4AFMAoGCCqGSM49BAMCA0gAMEUCIQC8NIMw' +
'e4ym/QRwCJb5umbONNLSVQuEpnPsJrM/ssBPvgIgQpe2oYa3yO3USro9nBHjpM3L' +
'KsFQrpVnF8O6hoHOYZQ=' +
'-----END CERTIFICATE-----';

const certWithMultipleAttributes = '-----BEGIN CERTIFICATE-----' +
'MIIChzCCAi6gAwIBAgIURilAHeqwLu/fNUv8eZoGPRh3H4IwCgYIKoZIzj0EAwIw' +
'czELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNh' +
'biBGcmFuY2lzY28xGTAXBgNVBAoTEG9yZzEuZXhhbXBsZS5jb20xHDAaBgNVBAMT' +
'E2NhLm9yZzEuZXhhbXBsZS5jb20wHhcNMTkwNzMxMTYxNzAwWhcNMjAwNzMwMTYy' +
'MjAwWjAgMQ8wDQYDVQQLEwZjbGllbnQxDTALBgNVBAMTBHRlc3QwWTATBgcqhkjO' +
'PQIBBggqhkjOPQMBBwNCAAR2taQK8w7D3hr3gBxCz+8eV4KSv7pFQfNjDHMMe9J9' +
'LJwcLpVTT5hYiLLRaqQonLBxBE3Ey0FneySvFuBScas3o4HyMIHvMA4GA1UdDwEB' +
'/wQEAwIHgDAMBgNVHRMBAf8EAjAAMB0GA1UdDgQWBBQi3mhXS/WzcjBniwAmPdYP' +
'kHqVVzArBgNVHSMEJDAigCC7VXjmSEugjAB/A0S6vfMxLsUIgag9WVNwtwwebnRC' +
'7TCBggYIKgMEBQYHCAEEdnsiYXR0cnMiOnsiYXR0cjEiOiJ2YWwxIiwiZm9vIjoi' +
'YmFyIiwiaGVsbG8iOiJ3b3JsZCIsImhmLkFmZmlsaWF0aW9uIjoiIiwiaGYuRW5y' +
'b2xsbWVudElEIjoidGVzdCIsImhmLlR5cGUiOiJjbGllbnQifX0wCgYIKoZIzj0E' +
'AwIDRwAwRAIgQxEFvnZTEsf3CSZmp9IYsxcnEOtVYleOd86LAKtk1wICIH7XOPwW' +
'/RE4Z8WLZzFei/78Oezbx6obOvBxPMsVWRe5' +
'-----END CERTIFICATE-----';
describe('Client-Identity', () => {

    it ('should throw an error when using a bad cert', () => {
        const stub = mockStub('I AM NOT A CERT');
        expect(() => {
            new shim.ClientIdentity(stub);
        }).to.throw(/Failed to find start line or end line of the certificate./);
    });

    describe('Certificate with attributes', () => {
        const stub = mockStub(certWithAttrs);
        const cid = new shim.ClientIdentity(stub);

        it ('should have correct mspId', () => {
            expect(cid.getMSPID()).to.deep.equal('dummyId');
        });

        it ('should return correct value on getID()', () => {
            expect(cid.getID()).to.deep.equal('x509::/CN=MyTestUserWithAttrs::/CN=fabric-ca-server');
        });

        it ('should have correct attrs', () => {
            expect(cid.attrs.attr1).to.deep.equal('val1');
        });

        it ('should return correct values on getX509Certificate()', () => {
            const x509 = cid.getX509Certificate();

            expect(x509.subject.commonName).to.deep.equal('MyTestUserWithAttrs');
            expect(x509.serial).to.deep.equal('1E4998E9F44FD00353BF3681C0A0A431964F5275');
        });

        it ('should return the value when getAttributeValue() called with known attribute', () => {
            expect(cid.getAttributeValue('attr1')).to.deep.equal('val1');
        });

        it ('should return null when getAttributeValue() called with unknown attribute', () => {
            expect(cid.getAttributeValue('unknown')).to.be.null;
        });

        it ('should return true when value provided matches known attribute in assertAttributeValue()', () => {
            expect(cid.assertAttributeValue('attr1', 'val1')).to.deep.equal(true);
        });

        it ('should return false when value provided does not match known attribute in assertAttributeValue()', () => {
            expect(cid.assertAttributeValue('attr1', 'val2')).to.deep.equal(false);
        });

        it ('should return false when unknown attribute in assertAttributeValue()', () => {
            expect(cid.assertAttributeValue('unknown', 'val1')).to.deep.equal(false);
        });
    });

    describe('Certificate without attributes', () => {
        const stub = mockStub(certWithoutAttrs);
        const cid = new shim.ClientIdentity(stub);

        it ('should have correct mspId', () => {
            expect(cid.getMSPID()).to.deep.equal('dummyId');
        });

        it ('should have not attributes', () => {
            expect(cid.attrs).to.deep.equal({});
        });
    });

    describe('Certificate with long DNs', () => {
        const stub = mockStub(certWithLongDNs);
        const cid = new shim.ClientIdentity(stub);

        it ('should return correct value on getID()', () => {
            expect(cid.getID()).to.deep.equal('x509::/C=US/ST=California/L=San Francisco/CN=User1@org2.example.com::/C=US/ST=California/L=San Francisco/O=org2.example.com/CN=ca.org2.example.com');
        });
    });

    describe('Certificate with multiple attributes', () => {
        const stub = mockStub(certWithMultipleAttributes);
        const cid = new shim.ClientIdentity(stub);

        it ('should return correct value on getID()', () => {
            expect(cid.getID()).to.deep.equal('x509::/OU=client/CN=test::/C=US/ST=California/L=San Francisco/O=org1.example.com/CN=ca.org1.example.com');
        });

        it ('should have correct mspId', () => {
            expect(cid.getMSPID()).to.deep.equal('dummyId');
        });

        it('should have correct attributes', () => {
            expect(cid.attrs.attr1).to.deep.equal('val1');
            expect(cid.attrs.hello).to.deep.equal('world');
            expect(cid.attrs.foo).to.deep.equal('bar');
        });
    });

});

function mockStub(cert) {
    return {
        getCreator: function() {
            return {
                getMspid: function() {
                    return 'dummyId';
                },
                getIdBytes: function() {
                    const buf = Buffer.from(cert);
                    buf.toBuffer = function() {
                        return this;
                    };
                    return buf;
                }
            };
        },
        getTxID: function() {
            return 'dummy Tx ID';
        },
        getChannelID: function() {
            return 'dummy channel ID';
        }
    };
}
