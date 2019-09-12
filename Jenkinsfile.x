// Copyright IBM Corp All Rights Reserved
//
// SPDX-License-Identifier: Apache-2.0
//
timeout(40) {
    node ('hyp-x') { // trigger build on x86_64 node
        timestamps {
            def ROOTDIR = pwd() // workspace dir (/w/workspace/<job_name>)
            try {  
                env.PROJECT_DIR = "gopath/src/github.com/hyperledger"
                env.PROJECT = "fabric-chaincode-node"
                env.GOPATH = "$WORKSPACE/gopath"
                env.ARCH = "amd64"
                def nodeHome = tool 'nodejs-10.15.2'
                env.VERSION = sh(returnStdout: true, script: 'curl -O https://raw.githubusercontent.com/hyperledger/fabric/master/Makefile && cat Makefile | grep "BASE_VERSION =" | cut -d "=" -f2').trim()
                env.IMAGE_TAG = "${ARCH}-latest" // fabric latest stable version from nexus
                env.PATH = "$GOPATH/bin:/usr/local/bin:/usr/bin:/usr/local/sbin:/usr/sbin:${nodeHome}/bin:$PATH"
                def jobname = sh(returnStdout: true, script: 'echo ${JOB_NAME} | grep -q "verify" && echo patchset || echo merge').trim()
                def failure_stage = "none"
                env.PATH = "${env.PATH}:${nodeHome}/bin"
                // delete working directory
                deleteDir()
                stage("Fetch Patchset") {
                    cleanWs()
                    try {
                        if (jobname == "patchset")  {
                            println "IN VERIFY PATCHSET"
                            println "$GERRIT_REFSPEC"
                            println "$GERRIT_BRANCH"
                            checkout([
                                $class: 'GitSCM',
                                branches: [[name: '$GERRIT_REFSPEC']],
                                extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'gopath/src/github.com/hyperledger/$PROJECT'], [$class: 'CheckoutOption', timeout: 10]],
                                userRemoteConfigs: [[credentialsId: 'hyperledger-jobbuilder', name: 'origin', refspec: '$GERRIT_REFSPEC:$GERRIT_REFSPEC', url: '$GIT_BASE']]
                            ])
                            dir("${ROOTDIR}/$PROJECT_DIR") {
                                sh '''
                                    # Clone fabric repository
                                    git clone --single-branch -b $GERRIT_BRANCH https://github.com/hyperledger/fabric
                                    # Clone fabric-samples repository
                                    git clone --single-branch -b $GERRIT_BRANCH --depth=1 https://github.com/hyperledger/fabric-samples
                                '''
                            }
                        } else {
                            // Clone fabric-chaincode-node on merge
                            println "Clone $PROJECT repository"
                            checkout([
                                $class: 'GitSCM',
                                branches: [[name: 'refs/heads/$GERRIT_BRANCH']],
                                extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: 'gopath/src/github.com/hyperledger/$PROJECT']],
                                userRemoteConfigs: [[credentialsId: 'hyperledger-jobbuilder', name: 'origin', refspec: '+refs/heads/$GERRIT_BRANCH:refs/remotes/origin/$GERRIT_BRANCH', url: '$GIT_BASE']]
                            ])
                            dir("${ROOTDIR}/$PROJECT_DIR") {
                                sh '''
                                    # Clone fabric repository
                                    git clone --single-branch -b $GERRIT_BRANCH https://github.com/hyperledger/fabric
                                    # Clone fabric-samples repository
                                    git clone --single-branch -b $GERRIT_BRANCH --depth=1 https://github.com/hyperledger/fabric-samples
                                '''
                            }
                        }

                        dir("${ROOTDIR}/$PROJECT_DIR/$PROJECT") {
                            sh '''
                                # Print last two commit details
                                echo
                                git log -n2 --pretty=oneline --abbrev-commit
                                echo
                            '''
                        }
                    } catch (err) {
                        failure_stage = "Fetch patchset"
                        currentBuild.result = 'FAILURE'
                        throw err
                    }
                }

                // clean environment and get env data
                stage("Clean Environment - Get Env Info") {
                // wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
                    try {
                        dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                            sh './CI_Script.sh --clean_Environment --env_Info'
                        }
                    } catch (err) {
                        failure_stage = "Clean Environment - Get Env Info"
                        currentBuild.result = 'FAILURE'
                        throw err
                    }
                // }
                }

                // Pull Fabric, Fabric-ca Images
                stage("Pull Docker Images") {
                // wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
                    try {
                        dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                            sh './CI_Script.sh --pull_Docker_Images'
                        }
                    } catch (err) {
                        failure_stage = "Pull fabric, fabric-ca docker images"
                        currentBuild.result = 'FAILURE'
                        throw err
                    }
                // }
                }

                // Run Full Builds
                stage("Run Full Build") {
                // wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
                    try {
                        dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                            sh './CI_Script.sh --fullBuild'
                        }
                    } catch (err) {
                        failure_stage = "fullBuild"
                        currentBuild.result = 'FAILURE'
                        throw err
                    }
                // }
                }

                // Publish hyperledger/fabric-nodeenv image from merged job only
                if (env.JOB_NAME == "fabric-chaincode-node-merge-x86_64") {
                    publishNodeenv()
                } else {
                    echo "------> Don't publish nodeenv image from verify job"
                }

                // Publish npm modules from merged job
                if (env.JOB_NAME == "fabric-chaincode-node-merge-x86_64") {
                    publishNpm()
                } else {
                    echo "------> Don't publish npm modules from verify job"
                }

                // Publish API Docs from merged job only
                if (env.JOB_NAME == "fabric-chaincode-node-merge-x86_64") {
                    apiDocs()
                } else {
                    echo "------> Don't publish API Docs from verify job"
                }

            } finally { 
                // the multiple report files that are now generated as a side effect of using rush are not 
                // supported within Jenkins. As these are revered as part of the developer build this reporting is not
                // a concern
                
                dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/") {
                    archiveArtifacts allowEmptyArchive: true, artifacts: '**/*.log'
                }
                if (env.JOB_NAME == "fabric-chaincode-node-merge-x86_64") {
                    if (currentBuild.result == 'FAILURE') { // Other values: SUCCESS, UNSTABLE
                        rocketSend "Build Notification - STATUS: *${currentBuild.result}* - BRANCH: *${env.GERRIT_BRANCH}* - PROJECT: *${env.PROJECT}* - BUILD_URL - (<${env.BUILD_URL}|Open>)"
                    }
                }
            } // finally block
        } // timestamps block
    } // node block
} // timeout block

// Publish npm modules after successful merge
def publishNpm() {
    stage("Publish npm Modules") {
        def ROOTDIR = pwd()
        withCredentials([[$class       : 'StringBinding',
                      credentialsId: 'NPM_LOCAL',
                      variable : 'NPM_TOKEN']]) {
            // wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
            try {
                dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                    sh './CI_Script.sh --publish_NpmModules'
                }
            } catch (err) {
                failure_stage = "publish_NpmModules"
                currentBuild.result = 'FAILURE'
                throw err
            }
        // }
        }
    }
}

// Publish Chaincode node API docs after successful merge
def apiDocs() {
    stage("Publish API Docs") {
        def ROOTDIR = pwd()
        withCredentials([[$class     : 'UsernamePasswordMultiBinding',
                         credentialsId: 'chaincode-node-credentials',
                         usernameVariable: 'CHAINCODE_NODE_USERNAME',
                         passwordVariable: 'CHAINCODE_NODE_PASSWORD']]) {
            // wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
            try {
                dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                    sh './CI_Script.sh --publish_ApiDocs'
                }
            } catch (err) {
                failure_stage = "publish_Api_Docs"
                currentBuild.result = 'FAILURE'
                throw err
            }
            // }
        }
    }
}

// Publish Chaincode_node nodeenv image after successful merge
def publishNodeenv() {
    stage("Publish nodeenv image") {
        def ROOTDIR = pwd()
        configFileProvider([configFile(fileId: 'fabric-settings', variable: 'SETTINGS_FILE')]) {
            // wrap([$class: 'AnsiColorBuildWrapper', 'colorMapName': 'xterm']) {
            try {
                dir("${ROOTDIR}/$PROJECT_DIR/fabric-chaincode-node/scripts/Jenkins_Scripts") {
                    sh './CI_Script.sh --publish_Nodeenv_Image'
                }
            } catch (err) {
                failure_stage = "publish_nodeenv_image"
                currentBuild.result = 'FAILURE'
                throw err
            }
            // }
        }
    }
}
