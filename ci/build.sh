#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/jenkins/tools/pnpm-11.15.1/node_modules/.bin:/home/jenkins/tools/node/bin:$PATH"
if ! test -x /home/jenkins/tools/pnpm-11.15.1/node_modules/.bin/pnpm; then npm install --prefix /home/jenkins/tools/pnpm-11.15.1 --ignore-scripts pnpm@11.15.1; fi
export NODE_OPTIONS=--max-old-space-size=3072
pnpm run copy-templates
pnpm run build:frontend
printf '%s\n' node_modules .git coverage .scannerwork > Dockerfile.fantasize.dockerignore
buildctl --addr unix:///buildkit/buildkitd.sock build --frontend dockerfile.v0 --local context=. --local dockerfile=. --opt filename=Dockerfile.fantasize --output type=oci,dest=image.tar
python3 - <<'PY'
import json,subprocess,os
sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
json.dump({'repository':'registry.fantasizetech.co/fantasizetech/unleash-fantasize','tag':sha,'revision':sha,'sourceRevision':sha,'sonarProjectKey':'FantasizeTech_unleash-fantasize'},open('release.json','w'))
PY
