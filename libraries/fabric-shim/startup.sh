DIR=$(pwd)

# MAKE IT GO THROUGH THE ARGS ONE BY ONE AND IF IT IS THE LABEL --module-path THEN GET THE NEXT ARG AND USE THAT AS THE CD OVER THE ENV VAR
GRAB_NEXT=false
for var in "$@"; do
    if [ $var = "--module-path" ]; then
        GRAB_NEXT=true
    elif [ $GRAB_NEXT = true ]; then
        CORE_MODULE_PATH="$var"
    fi
done
cd $CORE_MODULE_PATH

if grep -q "fabric-contract-api" package.json; then
    cd $DIR
    node cli.js start "$@"
else
    npm start -- "$@"
fi