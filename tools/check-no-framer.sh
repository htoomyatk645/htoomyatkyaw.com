#!/usr/bin/env sh
# Fail if anything in ./site still references Framer-hosted URLs.
set -eu
pattern='https?:(\\?/){2}([a-z0-9-]+\.)*(framer\.(com|app|website|ai)|framerusercontent\.com|framerstatic\.com)'
if grep -rIEnoi "$pattern" site | head -50 | grep .; then
  echo "Framer references remain in ./site (above)." >&2
  exit 1
fi
echo "No Framer-hosted URLs in ./site."
