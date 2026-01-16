#!/usr/bin/env bash
set -euo pipefail

DEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/modules/controller"

# You can set:
# - CONTROLLER_C_REF=main (default) or a tag/commit
# - CURL_INSECURE=1 (only if your environment has broken CA certs)
REF="${CONTROLLER_C_REF:-main}"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required" >&2
  exit 1
fi

if ! git lfs version >/dev/null 2>&1; then
  echo "git-lfs is required to download Controller.xcframework binaries (Git LFS)." >&2
  echo "" >&2
  echo "Install on macOS:" >&2
  echo "  brew install git-lfs" >&2
  echo "  git lfs install" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

REPO_DIR="$TMP_DIR/controller.c"

echo "Cloning controller.c (ref: $REF)…"
git clone https://github.com/cartridge-gg/controller.c.git "$REPO_DIR"
cd "$REPO_DIR"
git checkout "$REF" >/dev/null 2>&1 || git checkout "refs/tags/$REF" >/dev/null 2>&1 || git checkout "refs/heads/$REF"

echo "Pulling Git LFS assets…"
git lfs pull --include "examples/react-native/modules/controller/Controller.xcframework/**"

SRC_DIR="$REPO_DIR/examples/react-native/modules/controller"
if [[ ! -d "$SRC_DIR" ]]; then
  echo "Upstream path not found: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

echo "Syncing native assets into $DEST_DIR (ios/, cpp/, Controller.xcframework/)…"
rm -rf "$DEST_DIR/ios" "$DEST_DIR/cpp" "$DEST_DIR/Controller.xcframework"
cp -R "$SRC_DIR/ios" "$DEST_DIR/ios"
cp -R "$SRC_DIR/cpp" "$DEST_DIR/cpp"
cp -R "$SRC_DIR/Controller.xcframework" "$DEST_DIR/Controller.xcframework"

echo "Done."

