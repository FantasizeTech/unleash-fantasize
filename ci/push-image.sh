#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077
sha256sum -c verified-image.sha256
test -s prepush-scan.json && test -s prepush-sbom.json
mkdir -p /home/jenkins/tools/crane-0.22.1
crane=/home/jenkins/tools/crane-0.22.1/crane
work=$(mktemp -d)
trap 'rm -rf "$work" .verified-oci' EXIT
if ! test -x "$crane"; then
  curl -fsSL --retry 3 --max-time 180 https://github.com/google/go-containerregistry/releases/download/v0.22.1/go-containerregistry_Linux_x86_64.tar.gz -o "$work/crane.tar.gz"
  printf '%s  %s\n' 0ab7a1d6932a213aed964ce97666c3077fe691c8606413674a8b3e0b9ec4cda0 "$work/crane.tar.gz" | sha256sum -c -
  tar -xzf "$work/crane.tar.gz" -C /home/jenkins/tools/crane-0.22.1 crane
fi
export DOCKER_CONFIG="$work/docker"
mkdir -p "$DOCKER_CONFIG"
python3 - <<'PY'
import os,json,base64
from pathlib import Path
p=Path(os.environ['DOCKER_CONFIG'])/'config.json'
p.write_text(json.dumps({'auths':{'registry.fantasizetech.co':{'auth':base64.b64encode((os.environ['HARBOR_USER']+':'+os.environ['HARBOR_PASSWORD']).encode()).decode()}}}))
PY
mkdir .verified-oci
tar -xf image.tar -C .verified-oci
ref=$(python3 -c 'import json; r=json.load(open("release.json")); print(r["repository"]+":"+r["tag"])')
"$crane" push .verified-oci "$ref"
"$crane" digest "$ref" > pushed-digest.txt
python3 - <<'PY'
import json,hashlib,re
from pathlib import Path
index=Path('.verified-oci/index.json').read_bytes()
allowed={x['digest'] for x in json.loads(index)['manifests']}|{'sha256:'+hashlib.sha256(index).hexdigest()}
digest=Path('pushed-digest.txt').read_text().strip()
assert re.fullmatch('sha256:[a-f0-9]{64}',digest) and digest in allowed, 'Published digest differs from verified OCI artifact'
r=json.loads(Path('release.json').read_text());r['digest']=digest;r['prepushArchiveSha256']=Path('verified-image.sha256').read_text().split()[0]
Path('release.json').write_text(json.dumps(r,indent=2)+'\n')
Path('image-ref.txt').write_text(r['repository']+'@'+digest+'\n')
print('PASS: published exactly the verified image:',r['repository']+'@'+digest)
PY
rm image.tar
