# Rename the key files we use to be key.pem instead of a uuid
BASEDIR=$(dirname "$0")

for KEY in $(find ${BASEDIR}/crypto-config -type f -name "*_sk"); do
    KEY_DIR=$(dirname ${KEY})
    mv ${KEY} ${KEY_DIR}/key.pem
done