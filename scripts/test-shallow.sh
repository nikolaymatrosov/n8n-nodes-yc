#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Testing shallow install compatibility..."

# Ensure a clean build of *your* package first
echo "📦 Building package..."
rm -rf dist node_modules package-lock.json
npm i
npm run build

# Create a tarball of the publishable content (respects .npmignore/files)
PKG_TGZ="$(npm pack --silent)"
echo "✓ Packed: $PKG_TGZ"

# Make an isolated test app
TMPDIR="$(mktemp -d)"
echo "📁 Created test directory: $TMPDIR"
pushd "$TMPDIR" >/dev/null

# Create a bare test project
echo "📝 Initializing test project..."
npm init -y >/dev/null

# (Optional) If you rely on peer deps provided by a host (e.g., n8n),
# install them here to emulate the host environment:
echo "📥 Installing peer dependencies..."
npm install n8n-workflow@^1 --install-strategy=shallow --silent

# Try to install your tarball with the same flags that often break things
echo "🔧 Installing package with shallow strategy..."
npm install "$OLDPWD/$PKG_TGZ" \
  --install-strategy=shallow \
  --ignore-scripts=true \
  --audit=false \
  --fund=false \
  --bin-links=false \
  --package-lock=false

# Fail fast if anything is missing/resolved via hoisting
echo "🔎 Checking dependency tree..."
npm ls --all 2>&1 | head -50 || true   # prints tree; will nonzero on problems in some cases

# Minimal runtime smoke test: can Node require your package?
echo "🧪 Running smoke test..."
node -e "require(require('path').resolve('.', 'node_modules', '@nikolaymatrosov', 'n8n-nodes-yc'))"

echo "✅ Shallow install & require() smoke test passed."
popd >/dev/null

# cleanup
echo "🧹 Cleaning up..."
rm -rf "$TMPDIR" "$PKG_TGZ"

echo "✨ All tests passed!"
