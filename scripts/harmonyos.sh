#!/usr/bin/env bash
set -euo pipefail

tools_dir="$RUNNER_TEMP/harmonyos-command-line-tools"
archive="$RUNNER_TEMP/harmonyos-command-line-tools.zip"
mkdir -p "$tools_dir"

release_json="$(curl --fail --silent --show-error \
  https://api.github.com/repos/harmonyos-dev/hos-sdk/releases/latest \
  )"
test "$(jq -r '.name' <<< "$release_json")" = "Command Line Tools 26.0.0 Release"
asset_url="$(jq -r '.assets[] | select(.name | test("commandline-tools-linux-.*\\.zip$")) | .browser_download_url' <<< "$release_json" | head -n 1)"
test -n "$asset_url"
curl --fail --location --show-error "$asset_url" --output "$archive"
unzip -q "$archive" -d "$tools_dir"

command_line_tools="$(dirname "$(find "$tools_dir" -type f -name sdkmgr -print -quit)" | sed 's#/sdkmanager/bin$##')"
chmod +x "$command_line_tools/sdkmanager/bin/sdkmgr"
JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} -Duser.country=CN" \
  "$command_line_tools/sdkmanager/bin/sdkmgr" install \
  toolchains:9 OpenHarmony/toolchains:9 --accept-license

hvigorw_path="$(find "$tools_dir" -type f \( -name hvigorw -o -name hvigorw.sh \) -print -quit)"
deveco_home="$(dirname "$(dirname "$hvigorw_path")")"
sdk_home="$(dirname "$(dirname "$(dirname "$(find "$tools_dir" -type d -path '*/default/openharmony/toolchains' -print -quit)")")")"
test -x "$deveco_home/tools/ohpm/bin/ohpm"
test -x "$deveco_home/tools/hvigor/bin/hvigorw"
test -x "$sdk_home/default/openharmony/toolchains/hdc"

export DEVECO_HOME="$deveco_home"
export DEVECO_SDK_HOME="$sdk_home"

if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "DEVECO_HOME=$DEVECO_HOME" >> "$GITHUB_ENV"
  echo "DEVECO_SDK_HOME=$DEVECO_SDK_HOME" >> "$GITHUB_ENV"
fi
pnpm run harmonyos:build
