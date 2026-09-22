#!/usr/bin/env bash
set +x
set -euo pipefail
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p /home/jenkins/tools/trivy-0.74.0
trivy=/home/jenkins/tools/trivy-0.74.0/trivy
if ! test -x "$trivy"; then
  curl -fsSL --retry 3 --max-time 180 https://github.com/aquasecurity/trivy/releases/download/v0.74.0/trivy_0.74.0_Linux-64bit.tar.gz -o "$work/trivy.tar.gz"
  printf '%s  %s\n' 2ae6fe3ee734b7fdf11335663e18c75ea12dccc76062f09f164a3b0f8be4371a "$work/trivy.tar.gz" | sha256sum -c -
  tar -xzf "$work/trivy.tar.gz" -C /home/jenkins/tools/trivy-0.74.0 trivy
fi
sha256sum image.tar > verified-image.sha256
mkdir "$work/oci"
tar -xf image.tar -C "$work/oci"
"$trivy" image --input "$work/oci" --timeout 15m --scanners vuln --severity HIGH,CRITICAL --exit-code 1 --format json --output prepush-scan.json
"$trivy" image --input "$work/oci" --timeout 15m --format cyclonedx --output prepush-sbom.json
printf 'PASS: locally built image has no High/Critical findings; SBOM generated before publishing.\n'
