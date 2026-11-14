#!/usr/bin/env bash
# Builds dist/firefox and dist/chrome (+ zips) from src/ and manifests/.
set -e
cd "$(dirname "$0")"
rm -rf dist
for b in firefox chrome; do
  mkdir -p "dist/$b"
  cp src/* "dist/$b/"
  cp "manifests/$b.json" "dist/$b/manifest.json"
  (cd "dist/$b" && zip -qr "../veloura-$b.zip" .)
done
echo "Built: dist/firefox  dist/chrome  (and zips in dist/)"
