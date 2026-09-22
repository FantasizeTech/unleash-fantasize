#!/usr/bin/env bash
set +x
set -euo pipefail
: "${SONAR_TOKEN:?Missing analysis token}" "${SONAR_PROJECT_KEY:?Missing project key}"
export SONAR_HOST_URL=https://sonar.infra.fantasizetech.co
export DOTNET_ROOT=/home/jenkins/tools/dotnet
export PATH="/home/jenkins/tools/node/bin:$DOTNET_ROOT:/home/jenkins/tools/dotnet-sonar:$PATH"
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1
export SONAR_SCANNER_JAVA_OPTS='-Xmx768m'
revision=$(git rev-parse HEAD)
[[ "$revision" =~ ^[a-f0-9]{40}$ ]]
# Exclude generated dependencies/build artifacts, never application source.
exclusions='**/node_modules/**,**/bin/**,**/obj/**,**/.next/**,**/dist/**,**/build/**,**/.git/**,**/.sonarqube/**,**/.scannerwork/**,**/coverage/**,**/vendor/**,**/venv/**,**/.venv/**'
mkdir -p qa
common=("-Dsonar.host.url=$SONAR_HOST_URL" "-Dsonar.projectKey=$SONAR_PROJECT_KEY" "-Dsonar.projectVersion=$revision" "-Dsonar.scm.revision=$revision" '-Dsonar.qualitygate.wait=true' '-Dsonar.qualitygate.timeout=600' '-Dsonar.qualitygate.ignoreSmallChanges=false' "-Dsonar.exclusions=$exclusions" '-Dsonar.javascript.node.maxspace=4096' '-Dsonar.nodejs.executable=/home/jenkins/tools/node/bin/node' '-Dsonar.typescript.tsconfigPaths=tsconfig.json,frontend/tsconfig.json' '-Dsonar.text.inclusions=**/*.md,**/*.swift,**/*.properties,**/*.env,**/*.conf,**/*.sh' '-Dsonar.javascript.lcov.reportPaths=coverage/lcov.info' '-Dsonar.tests=.' '-Dsonar.test.inclusions=**/*.test.*,**/*.spec.*,**/__tests__/**' "-Dsonar.test.exclusions=$exclusions")
if find . -name '*.csproj' -not -path '*/obj/*' -not -path '*/bin/*' -print -quit | grep -q .; then
  # .NET requires MSBuild integration; generic CLI is not a C# analysis substitute.
  dotnet sonarscanner begin "/k:$SONAR_PROJECT_KEY" "/v:$revision" "/d:sonar.host.url=$SONAR_HOST_URL" "/d:sonar.token=$SONAR_TOKEN" "/d:sonar.scm.revision=$revision" '/d:sonar.qualitygate.wait=true' '/d:sonar.qualitygate.timeout=600' '/d:sonar.qualitygate.ignoreSmallChanges=false' "/d:sonar.exclusions=$exclusions"
  mapfile -t solutions < <(find . \( -name '*.sln' -o -name '*.slnx' \) -not -path '*/obj/*' -not -path '*/bin/*' | sort)
  if ((${#solutions[@]})); then
    for solution in "${solutions[@]}"; do dotnet build "$solution" --configuration Release --no-incremental -m:1; done
  else
    while IFS= read -r -d '' project; do dotnet build "$project" --configuration Release --no-incremental -m:1; done < <(find . -name '*.csproj' -not -path '*/obj/*' -not -path '*/bin/*' -print0)
  fi
  dotnet sonarscanner end "/d:sonar.token=$SONAR_TOKEN"
  cp .sonarqube/out/.sonar/report-task.txt qa/report-task.txt
else
  /home/jenkins/tools/sonar-scanner-8.1.0.6389-linux-x64/bin/sonar-scanner "${common[@]}" '-Dsonar.sources=.'
  cp .scannerwork/report-task.txt qa/report-task.txt
fi
if git ls-files '*.swift' | grep -q .; then
  echo 'BLOCKED: Swift source is not supported by this SonarQube Community instance. No build/deploy approval is issued.' >&2
  exit 3
fi
printf '%s\n' "$revision" > qa/revision.txt
printf '%s\n' "$SONAR_PROJECT_KEY" > qa/project.txt
