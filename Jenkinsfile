pipeline {
    agent { label 'staging-build' }
    options { disableConcurrentBuilds(); timeout(time: 90, unit: 'MINUTES'); buildDiscarder(logRotator(numToKeepStr: '15')); skipDefaultCheckout() }
    environment { SONAR_PROJECT_KEY = 'FantasizeTech_unleash-fantasize' }
    stages {
        stage('Checkout main') { steps { checkout([$class: 'GitSCM', branches: [[name: '*/main']], userRemoteConfigs: [[url: 'https://github.com/FantasizeTech/unleash-fantasize.git']], extensions: [[$class: 'CloneOption', shallow: true, depth: 20, noTags: true], [$class: 'CleanBeforeCheckout']]]) } }
        stage('Test and coverage') { steps { sh 'bash ci/test.sh' }
 post { always { archiveArtifacts artifacts: 'coverage/**', allowEmptyArchive: true } } }
        stage('SonarQube Quality Gate') { steps { withCredentials([string(credentialsId: 'sonarqube-analysis-token', variable: 'SONAR_TOKEN')]) { sh 'bash ci/sonar.sh' } }
 post { always { archiveArtifacts artifacts: 'qa/**', allowEmptyArchive: true } } }
        stage('Build image') { steps { sh 'bash ci/build.sh' } }
        stage('Verify image') { steps { sh 'bash ci/verify-image.sh' }
 post { always { archiveArtifacts artifacts: 'prepush-*.json,verified-image.sha256', allowEmptyArchive: true } } }
        stage('Push Harbor image') { steps { withCredentials([usernamePassword(credentialsId: 'harbor-fantasizetech-publisher', usernameVariable: 'HARBOR_USER', passwordVariable: 'HARBOR_PASSWORD')]) { sh 'bash ci/push-image.sh' }
 archiveArtifacts artifacts: 'release.json,image-ref.txt', fingerprint: true } }
    }
}
