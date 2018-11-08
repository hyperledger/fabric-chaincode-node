// Copyright IBM Corp All Rights Reserved
//
// SPDX-License-Identifier: Apache-2.0
//
timeout(40) {
node ('hyp-x') { // trigger build on x86_64 node
    try {
     def ROOTDIR = pwd() // workspace dir (/w/workspace/<job_name>)
     env.PROJECT_DIR = "gopath/src/github.com/hyperledger"
     env.PROJECT = "fabric-chaincode-node"
     env.GOPATH = "$WORKSPACE/gopath"
     env.NODE_VER = "8.9.4"
     env.VERSION = sh(returnStdout: true, script: 'curl -O https://raw.githubusercontent.com/hyperledger/fabric/master/Makefile && cat Makefile | grep "BASE_VERSION =" | cut -d "=" -f2').trim()
     env.VERSION = "$VERSION" // BASE_VERSION from fabric Makefile
     env.ARCH = "amd64"
     env.IMAGE_TAG = "${ARCH}-${VERSION}-stable" // fabric latest stable version from nexus
     env.PROJECT_VERSION = "${VERSION}-stable"
     env.PATH = "$GOPATH/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:~/npm/bin:/home/jenkins/.nvm/versions/node/v{NODE_VER}/bin:$PATH"
     def failure_stage = "none"
// delete working directory
     deleteDir()
      stage("Fetch Patchset") { // fetch gerrit refspec on latest commit
          try {
              dir("${ROOTDIR}"){
              sh '''
                 [ -e gopath/src/github.com/hyperledger/ ] || mkdir -p $PROJECT_DIR
                 cd $PROJECT_DIR && git clone --single-branch -b $GERRIT_BRANCH git://cloud.hyperledger.org/mirror/$PROJECT
                 git clone --single-branch -b $GERRIT_BRANCH git://cloud.hyperledger.org/mirror/fabric-samples
                 cd $PROJECT && git checkout "$GERRIT_BRANCH" && git fetch origin "$GERRIT_REFSPEC" && git checkout FETCH_HEAD
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
                 sh './CI_Script.sh --pull_Docker_Images'
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
if (env.JOB_NAME == "fabric-chaincode-node-merge-x86_64") {
    unstableNpm()
}  else {
     echo "------> Don't publish npm modules from verify job"
   }

// Publish API Docs from merged job only
if (env.JOB_NAME == "fabric-chaincode-node-merge-x86_64") {
    apiDocs()
} else {
     echo "------> Don't publish API Docs from verify job"
   }
    } finally { // Code for coverage report
           step([$class: 'CoberturaPublisher', autoUpdateHealth: false, autoUpdateStability: false, coberturaReportFile: '**/cobertura-coverage.xml', failUnhealthy: false, failUnstable: false, maxNumberOfBuilds: 0, onlyStable: false, sourceEncoding: 'ASCII', zoomCoverageChart: false])
           archiveArtifacts allowEmptyArchive: true, artifacts: '**/*.log'
           if (env.JOB_NAME == "fabric-chaincode-node-merge-x86_64") {
              if (currentBuild.result == 'FAILURE') { // Other values: SUCCESS, UNSTABLE
               rocketSend "Build Notification - STATUS: ${currentBuild.result} - BRANCH: ${env.GERRIT_BRANCH} - PROJECT: ${env.PROJECT} - BUILD_URL - (<${env.BUILD_URL}|Open>)"
              }
           }
      } // finally block
} // node block
} // timeout block

def unstableNpm() {
// Publish unstable npm modules after successful merge
      stage("Publish Unstable npm Modules") {
      def ROOTDIR = pwd()
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
// Publish SDK_NODE API docs after successful merge
      stage("Publish API Docs") {
      def ROOTDIR = pwd()
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --publish_ApiDocs'
                 }
               }
           catch (err) {
                 failure_stage = "publish_ApiDocs"
                 throw err
           }
      }
}
