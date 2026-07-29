#!/usr/bin/env bash

set -euo pipefail

ADB_ARGS=()
if [[ -n "${ANDROID_SERIAL:-}" ]]; then
  ADB_ARGS=(-s "$ANDROID_SERIAL")
fi

cleanup() {
  if [[ -n "${DEV_SERVER_PID:-}" ]]; then
    kill "$DEV_SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

adb "${ADB_ARGS[@]}" reverse tcp:1421 tcp:1421
pnpm --filter mobile run dev &
DEV_SERVER_PID=$!

bash ./android/gradlew -p android installDebug
adb "${ADB_ARGS[@]}" shell am start \
  -n com.nashaofu.shell360/.MainActivity

wait "$DEV_SERVER_PID"
