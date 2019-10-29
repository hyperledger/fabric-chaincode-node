#!/bin/bash 
set -e

# Grab the current directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/.. && pwd )"
esc=$(printf '\033')

files=$(find ${DIR} -name "*.build*.log")
for LOG in ${files}; do     
    realpath -q --relative-to="$(pwd)" ${LOG} | sed "s,.*error.*,${esc}[91m&${esc}[0m," 
done

