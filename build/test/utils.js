const ordererCA = '/etc/hyperledger/config/crypto-config/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem';

const tls = process.env.TLS && process.env.TLS.toLowerCase() === 'true' ? true : false;

exports.tls = tls;

exports.getTLSArgs = () => {
    if (tls) {
        return '--tls true --cafile ' + ordererCA;
    }

    return '';
};
