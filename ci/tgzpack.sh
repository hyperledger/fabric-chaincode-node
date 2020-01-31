#!/bin/bash
set -o pipefail

# Script to remove the node dev-depenencies from the package
# Found that the npm prune/npm install is sufficient non-deterministic
# that the only way to achieve reliability is to
# loop over the same operations. Checking to see if the produced
# shrinkwrap.json contains any dev dependencies


# Echo out version numbers and names for reference as there
# was varying behaviours with different versions
PKG_NAME=$(basename $(pwd))
echo ">> Starting packaging for ${PKG_NAME}"
echo "Node version"
node -v
echo "NPM version"
npm -v
echo ""
echo "npm install"
export NODE_ENV=production
npm install --only=production

echo "npm shrinkwrap"
npm shrinkwrap

cat ./npm-shrinkwrap.json | grep --silent '"dev"'
while [ $? -eq 0 ]; do
    echo "Shrinkwrap contains 'dev'... looping..."
    cat ./npm-shrinkwrap.json 
    npm prune --production
    npm shrinkwrap
    # grep for the "dev" element in the shrinkwrap
    # if this returns succesful error code it's been 
    # found and we need to re-run the whoel 
    cat ./npm-shrinkwrap.json | grep --silent '"dev"'
done

echo "npm pack"
npm pack
echo "<< packed ${PKG_NAME}"