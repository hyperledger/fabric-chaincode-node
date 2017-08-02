const shim = require('fabric-shim');

var chaincode = class {
	Init(stub) {
		return Promise.resolve(shim.success());
	}

	Invoke(stub) {
		console.log('Transaction ID: ' + stub.getTxID());

		return stub.getState('dummy')
		.then(() => {
			return shim.success();
		}, () => {
			return shim.error();
		});
	}
};

shim.start(new chaincode());