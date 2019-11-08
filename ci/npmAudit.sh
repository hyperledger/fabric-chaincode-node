#
# SPDX-License-Identifier: Apache-2.0
#

set -e
function runNpmAudit() {
    local n=0; local rc=1; local out=""
    while [ "$n" -ne  10 ] && [ "$rc" -ne 0 ]; do
        echo ">>> run npm audit - Attempt $n"
        out=$((npm audit) 2>&1 | grep -e ".*")
        if [[ $out == *"found 0 vulnerabilities"* ]]; then
            rc=0
        fi
        echo "${out}"
        if [[ $rc -ne 0 ]] && [[ $out != *"code ENOAUDIT"* ]]; then
            break
        fi
        n=$(( n + 1 ))
    done
    return $rc;
}
runNpmAudit
exit $?