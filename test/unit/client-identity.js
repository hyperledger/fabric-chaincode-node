/*
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
*/

const test = require('../base.js');
const shim = require('fabric-shim/lib/chaincode.js');

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

test('Constructor test', (t) => {
	let stub = mockStub(certWithAttrs);

	let cid = new shim.ClientIdentity(stub);
	t.equal(cid.mspId, 'dummyId', 'Test mspId value');
	t.equal(cid.getID(), 'x509::/CN=MyTestUserWithAttrs::/CN=fabric-ca-server', 'Test getID()');
	t.equal(cid.attrs['attr1'], 'val1', 'Test attributes contained in the certificate');
	t.equal(cid.getX509Certificate().serial, '1E4998E9F44FD00353BF3681C0A0A431964F5275', 'Test that the certificate was properly parsed by checking the serial');
	t.equal(cid.getAttributeValue('attr1'), 'val1', 'Test getAttributeValue() method for known attribute');
	t.equal(cid.getAttributeValue('unknown'), null, 'Test getAttributeValue() method for unknown attribute');
	t.equal(cid.assertAttributeValue('attr1', 'val1'), true, 'Test assertAttributeValue() method for known attribute');
	t.equal(cid.assertAttributeValue('unknown', 'val1'), false, 'Test assertAttributeValue() method for unknown attribute');
	t.equal(cid.assertAttributeValue('attr1', 'wrongValue'), false, 'Test assertAttributeValue() method for known attribute but wrong value');

	stub = mockStub(certWithoutAttrs);
	cid = new shim.ClientIdentity(stub);
	t.equal(cid.mspId, 'dummyId', 'Test mspId value');
	t.deepEqual(cid.attrs, {}, 'Test empty attributes in the certificate');

	stub = mockStub(certWithLongDNs);
	cid = new shim.ClientIdentity(stub);
	t.equal(cid.getID(), 'x509::/C=US/ST=California/L=San Francisco/CN=User1@org2.example.com::/C=US/ST=California/L=San Francisco/O=org2.example.com/CN=ca.org2.example.com', 'Test getID() with certificate having long DNs');

	t.end();
});

function mockStub(cert) {
	return {
		getCreator: function() {
			return {
				getMspid: function() { return 'dummyId'; },
				getIdBytes: function() {
					let buf = Buffer.from(cert);
					buf.toBuffer = function() { return this; };
					return buf;
				}
			};
		}
	};
}
