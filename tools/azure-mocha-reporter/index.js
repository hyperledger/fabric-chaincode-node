let mocha = require('mocha');
let MochaJUnitReporter = require('mocha-junit-reporter');

/**
 * Create a very simple multi reporter to split the results to both the standard
 * 'Spec' reports but also the 'mocha-junit-reporter' for the Azure Pipeline
 */
class AzureFriendlyReporter{

    constructor(runner,options){
        this.reports = [];

        //the name Spec is defined by mocha as one of the built in types
        let reporterClass = mocha.reporters['Spec'];
        this.reports.push(new reporterClass(runner,options)); 
    
        // additional class
        let junit = new MochaJUnitReporter(runner,options);
        this.reports.push(junit);
        
    }
    
    epilogue() {
        this.reports.forEach( (reportInstance)=> {
            reportInstance.epilogue();
        });
    }
}

module.exports = AzureFriendlyReporter;

