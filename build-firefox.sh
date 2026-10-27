#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
out="$root/dist/firefox"
zip_path="$root/dist/zentab-firefox.zip"

rm -rf "$out"
mkdir -p "$out"

cp "$root/newtab.html" "$root/newtab.css" "$root/newtab.js" "$out/"
cp -R "$root/fonts" "$out/fonts"
cp -R "$root/logos" "$out/logos"
cp "$root/manifest.firefox.json" "$out/manifest.json"

if command -v zip >/dev/null 2>&1; then
    rm -f "$zip_path"
    (cd "$out" && zip -qr "$zip_path" .)
    printf 'Packaged: %s\n' "${zip_path#"$root/"}"
else
    printf 'zip is not installed; skipping the packaged archive.\n'
fi

printf '\nFirefox build ready: %s\n' "${out#"$root/"}"
printf 'Load it from about:debugging#/runtime/this-firefox -> Load Temporary Add-on...\n'
