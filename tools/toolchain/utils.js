const ordererCA = '/etc/hyperledger/config/crypto-config/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem';
const org1CA = '/etc/hyperledger/config/crypto-config/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem';
const org2CA = '/etc/hyperledger/config/crypto-config/peerOrganizations/org2.example.com/tlsca/tlsca.org2.example.com-cert.pem';

const tls = process.env.TLS && process.env.TLS.toLowerCase() === 'true' ? true : false;

exports.tls = tls;

exports.getTLSArgs = () => {
    if (tls) {
        return '--tls true --cafile ' + ordererCA;
    }

    return '';
};

exports.getPeerAddresses = () => {
    if (tls) {
        return '--peerAddresses peer0.org1.example.com:7051 --tlsRootCertFiles ' + org1CA +
            ' --peerAddresses peer0.org2.example.com:8051 --tlsRootCertFiles ' + org2CA;
    } else {
        return '--peerAddresses peer0.org1.example.com:7051' +
            ' --peerAddresses peer0.org2.example.com:8051';
    }
};
