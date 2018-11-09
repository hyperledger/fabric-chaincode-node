// Copyright IBM Corp All Rights Reserved
//
// SPDX-License-Identifier: Apache-2.0
//
timeout(40) {
node ('hyp-x') { // trigger build on x86_64 node
   timestamps {
    try {
     def ROOTDIR = pwd() // workspace dir (/w/workspace/<job_name>)
     env.PROJECT_DIR = "gopath/src/github.com/hyperledger"
     env.PROJECT = "fabric-chaincode-node"
     env.GOPATH = "$WORKSPACE/gopath"
     env.ARCH = "amd64"
     env.PATH = "$GOPATH/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:$PATH"
     def failure_stage = "none"
     def nodeHome = tool 'nodejs-8.11.3'
     env.PATH = "${env.PATH}:${nodeHome}/bin"
// delete working directory
     deleteDir()
      stage("Fetch Patchset") { // fetch gerrit refspec on latest commit
          try {
              dir("${ROOTDIR}"){
              sh '''
                 [ -e gopath/src/github.com/hyperledger/ ] || mkdir -p $PROJECT_DIR
                 cd $PROJECT_DIR && git clone --single-branch -b $GERRIT_BRANCH git://cloud.hyperledger.org/mirror/$PROJECT
                 # clone fabric repository
                 git clone --single-branch -b $GERRIT_BRANCH git://cloud.hyperledger.org/mirror/fabric
                 # clone fabric-samples repository
                 git clone --single-branch -b $GERRIT_BRANCH git://cloud.hyperledger.org/mirror/fabric-samples
                 # Checkout to patch Refspec
                 cd $PROJECT && git checkout "$GERRIT_BRANCH" && git fetch origin "$GERRIT_REFSPEC" && git checkout FETCH_HEAD
                 git log -n2 --pretty=oneline --abbrev-commit
              '''
              }
          }
          catch (err) {
                 failure_stage = "Fetch patchset"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
      }
// clean environment and get env data
      stage("Clean Environment - Get Env Info") {
         wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --clean_Environment --env_Info'
                 }
               }
           catch (err) {
                 failure_stage = "Clean Environment - Get Env Info"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
         }
      }

// Run gulp tests (e2e tests)
      stage("Run Headless & E2E tests") {
         wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --sdk_E2e_Tests'
                 }
               }
           catch (err) {
                 failure_stage = "sdk_E2e_Tests"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
         }
      }

// Publish npm modules from merged job
if (env.JOB_NAME == "fabric-chaincode-node-merge-x86_64") {
    publishNpm()
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
     } // timestamps block
} // node block
} // timeout block

def publishNpm() {
// Publish npm modules after successful merge
      stage("Publish npm Modules") {
        def ROOTDIR = pwd()
        withCredentials([[$class       : 'StringBinding',
                      credentialsId: 'NPM_LOCAL',
                      variable : 'NPM_TOKEN']]) {
        wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --publish_NpmModules'
                 }
               }
           catch (err) {
                 failure_stage = "publish_NpmModules"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
        }
        }
      }
}

def apiDocs() {
// Publish SDK_NODE API docs after successful merge
      stage("Publish API Docs") {
        def ROOTDIR = pwd()
        withCredentials([[$class     : 'UsernamePasswordMultiBinding',
                         credentialsId: 'chaincode-node-credentials',
                         usernameVariable: 'CHAINCODE_NODE_USERNAME',
                         passwordVariable: 'CHAINCODE_NODE_PASSWORD']]) {
        wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
           try {
                 dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                 sh './CI_Script.sh --publish_ApiDocs'
                 }
               }
           catch (err) {
                 failure_stage = "publish_Api_Docs"
                 currentBuild.result = 'FAILURE'
                 throw err
           }
        }
        }
      }
}

