#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cat > "$work/askpass" <<'ASKPASS'
#!/bin/sh
printf '%s\n' "$DEPLOY_PASSWORD"
ASKPASS
chmod 700 "$work/askpass"
printf '%s\n' '10.0.100.203 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIGwO9uDT5L89RObhrBy4naQYPTDxmWHw8MsTF9ijGwxn' > "$work/known_hosts"
export SSH_ASKPASS="$work/askpass" SSH_ASKPASS_REQUIRE=force DISPLAY=jenkins
image=$(cat image-ref.txt)
[[ "$image" =~ ^registry.fantasizetech.co/fantasizetech/unleash-fantasize@sha256:[a-f0-9]{64}$ ]]
python3 - <<'PY' | ssh -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$work/known_hosts" -o ConnectTimeout=15 -o PreferredAuthentications=password -o PubkeyAuthentication=no "$DEPLOY_USER@10.0.100.203" "sudo -n python3 /opt/fantasize/unleash/deploy-fork.py '$image'"
import json,os
print(json.dumps({'username':os.environ['HARBOR_USER'],'password':os.environ['HARBOR_PASSWORD']}))
PY
