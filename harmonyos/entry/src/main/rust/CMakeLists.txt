cmake_minimum_required(VERSION 3.5.0)
project(shell360_native C)

if(CMAKE_OHOS_ARCH_ABI STREQUAL "arm64-v8a")
    set(RUST_TARGET "aarch64-unknown-linux-ohos")
elseif(CMAKE_OHOS_ARCH_ABI STREQUAL "x86_64")
    set(RUST_TARGET "x86_64-unknown-linux-ohos")
else()
    message(FATAL_ERROR "Unsupported HarmonyOS ABI: ${CMAKE_OHOS_ARCH_ABI}")
endif()

find_program(NPM_EXECUTABLE NAMES npm npm.cmd
    HINTS "$ENV{DEVECO_HOME}/tools/node"
    REQUIRED)

get_filename_component(WORKSPACE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../../.." ABSOLUTE)
string(REPLACE "-" "_" RUST_TARGET_ENV "${RUST_TARGET}")
string(TOUPPER "${RUST_TARGET_ENV}" RUST_TARGET_ENV_UPPER)

if(CMAKE_BUILD_TYPE STREQUAL "Release")
    set(RUST_PROFILE "release")
    set(NAPI_BUILD_ARG "--release")
else()
    set(RUST_PROFILE "debug")
    set(NAPI_BUILD_ARG)
endif()

set(RUST_LIBRARY
    "${WORKSPACE_DIR}/target/${RUST_TARGET}/${RUST_PROFILE}/libshell360_napi.so")
set(ENTRY_LIBRARY "${CMAKE_LIBRARY_OUTPUT_DIRECTORY}/libentry.so")

file(GLOB_RECURSE RUST_SOURCES CONFIGURE_DEPENDS
    "${WORKSPACE_DIR}/crates/*.rs")

add_custom_command(
    OUTPUT "${ENTRY_LIBRARY}"
    COMMAND "${CMAKE_COMMAND}" -E env
        "CC_${RUST_TARGET_ENV}=${CMAKE_C_COMPILER}"
        "CFLAGS_${RUST_TARGET_ENV}=--target=${RUST_TARGET}"
        "AR_${RUST_TARGET_ENV}=${CMAKE_AR}"
        "CARGO_TARGET_${RUST_TARGET_ENV_UPPER}_LINKER=${CMAKE_C_COMPILER}"
        "RUSTFLAGS=-C link-arg=--target=${RUST_TARGET} -C link-arg=-Wl,-soname,libentry.so"
        "${NPM_EXECUTABLE}" run build --
        --target "${RUST_TARGET}"
        ${NAPI_BUILD_ARG}
    COMMAND "${CMAKE_COMMAND}" -E copy_if_different
        "${RUST_LIBRARY}"
        "${ENTRY_LIBRARY}"
    DEPENDS
        "${WORKSPACE_DIR}/Cargo.toml"
        "${WORKSPACE_DIR}/Cargo.lock"
        ${RUST_SOURCES}
    WORKING_DIRECTORY "${WORKSPACE_DIR}/crates/shell360-napi"
    VERBATIM)

add_custom_target(entry ALL DEPENDS "${ENTRY_LIBRARY}")
