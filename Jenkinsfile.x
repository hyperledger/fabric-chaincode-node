// Copyright IBM Corp All Rights Reserved
//
// SPDX-License-Identifier: Apache-2.0
//
node ('hyp-x') { // trigger build on x86_64 node
    try {
     def ROOTDIR = pwd() // workspace dir (/w/workspace/<job_name>
     env.PROJECT_DIR = "gopath/src/github.com/hyperledger"
     env.PROJECT = "fabric-chaincode-node"
     env.GOPATH = "$WORKSPACE/gopath"
     env.JAVA_HOME = "/usr/lib/jvm/java-1.8.0-openjdk-amd64"
     env.PATH = "$GOPATH/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:~/npm/bin:/home/jenkins/.nvm/versions/node/v6.9.5/bin:/home/jenkins/.nvm/versions/node/v8.9.4/bin:$PATH"
     env.GOROOT = "/opt/go/go1.10.linux.amd64"
     env.PATH = "$GOROOT/bin:$PATH"
     def failure_stage = "none"
// delete working directory
     deleteDir()
      stage("Fetch Patchset") { // fetch gerrit refspec on latest commit
          try {
              dir("${ROOTDIR}"){
              sh '''
                 [ -e gopath/src/github.com/hyperledger/ ] || mkdir -p $PROJECT_DIR
                 cd $PROJECT_DIR && git clone --single-branch -b $GERRIT_BRANCH git://cloud.hyperledger.org/mirror/$PROJECT
                 cd $PROJECT && git checkout "$GERRIT_BRANCH" && git fetch origin "$GERRIT_REFSPEC" && git checkout FETCH_HEAD
                 cd .. && git clone --single-branch -b $GERRIT_BRANCH git://cloud.hyperledger.org/mirror/fabric
              '''
              }
          }
          catch (err) {
                 failure_stage = "Fetch patchset"
                 throw err
           }
      }
// clean environment and get env data
      stage("Clean Environment - Get Env Info") {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --clean_Environment --env_Info'
                 }
               }
           catch (err) {
                 failure_stage = "Clean Environment - Get Env Info"
                 throw err
           }
      }

// Pull Fabric, Fabric-ca Images
      stage("Pull Docker images") {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --pull_Fabric_Images --pull_Fabric_CA_Image'
                 }
               }
           catch (err) {
                 failure_stage = "Pull fabric, fabric-ca docker images"
                 throw err
           }
      }

// Run gulp tests (e2e tests)
      stage("Run Headless & E2E tests") {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --sdk_E2e_Tests'
                 }
               }
           catch (err) {
                 failure_stage = "sdk_E2e_Tests"
                 throw err
           }
      }

// Publish unstable npm modules from merged job
if (env.GERRIT_EVENT_TYPE == "change-merged") {
    unstableNpm()
}  else {
     echo "------> Don't publish npm modules from verify job"
   }

// Publish API Docs from merged job only
if (env.GERRIT_EVENT_TYPE == "change-merged") {
    apiDocs()
} else {
     echo "------> Don't publish API Docs from verify job"
   }

    } finally { // Code for coverage report
           junit '**/cobertura-coverage.xml'
           step([$class: 'CoberturaPublisher', autoUpdateHealth: false, autoUpdateStability: false, coberturaReportFile: '**/cobertura-coverage.xml', failUnhealthy: false, failUnstable: false, maxNumberOfBuilds: 0, onlyStable: false, sourceEncoding: 'ASCII', zoomCoverageChart: false])
           archiveArtifacts artifacts: '**/*.log'
      } // finally block end here
} // node block end here

def unstableNpm() {
def ROOTDIR = pwd()
// Publish unstable npm modules after successful merge
      stage("Publish Unstable npm modules") {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --publish_Unstable'
                 }
               }
           catch (err) {
                 failure_stage = "publish_Unstable"
                 throw err
           }
      }
}

def apiDocs() {
def ROOTDIR = pwd()
// Publish SDK_NODE API docs after successful merge
      stage("Publish API Docs") {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --publish_Api_Docs'
                 }
               }
           catch (err) {
                 failure_stage = "publish_Api_Docs"
                 throw err
           }
      }
}
