plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

val workspaceDir = rootProject.projectDir.parentFile
val generatedDir = layout.buildDirectory.get().asFile.resolve("generated")
val uniffiSourceDir = generatedDir.resolve("source/uniffi")
val debugRustDir = generatedDir.resolve("rust/debug/jniLibs")
val releaseRustDir = generatedDir.resolve("rust/release/jniLibs")
val webAssetsDir = generatedDir.resolve("webAssets")
val rustInputs = files(
    workspaceDir.resolve("Cargo.toml"),
    workspaceDir.resolve("Cargo.lock"),
    fileTree(workspaceDir.resolve("crates/shell360-ffi")) {
        include("Cargo.toml", "uniffi.toml", "**/*.rs")
    },
    fileTree(workspaceDir.resolve("crates/shell360-keygen")) {
        include("Cargo.toml", "**/*.rs")
    },
)
val mobileInputs = files(
    workspaceDir.resolve("package.json"),
    workspaceDir.resolve("pnpm-lock.yaml"),
    workspaceDir.resolve("pnpm-workspace.yaml"),
    workspaceDir.resolve("mobile/package.json"),
    workspaceDir.resolve("mobile/index.html"),
    workspaceDir.resolve("mobile/rsbuild.config.ts"),
    workspaceDir.resolve("mobile/tsconfig.json"),
    workspaceDir.resolve("bridge/package.json"),
    workspaceDir.resolve("bridge/rslib.config.ts"),
    workspaceDir.resolve("bridge/tsconfig.json"),
    workspaceDir.resolve("shared/package.json"),
    workspaceDir.resolve("shared/rslib.config.ts"),
    workspaceDir.resolve("shared/tsconfig.json"),
    fileTree(workspaceDir.resolve("mobile/src")),
    fileTree(workspaceDir.resolve("bridge/src")),
    fileTree(workspaceDir.resolve("shared/src")),
)
val hostOperatingSystem = System.getProperty("os.name").lowercase()
val hostLibraryName = when {
    hostOperatingSystem.contains("mac") -> "libshell360_ffi.dylib"
    hostOperatingSystem.contains("windows") -> "shell360_ffi.dll"
    else -> "libshell360_ffi.so"
}
val hostLibrary = workspaceDir.resolve("target/debug/$hostLibraryName")

android {
    namespace = "com.nashaofu.shell360"
    compileSdk {
        version = release(37) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.nashaofu.shell360"
        minSdk = 29
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            buildConfigField("String", "WEBVIEW_URL", "\"http://127.0.0.1:1421\"")
            buildConfigField("String", "WEBVIEW_ORIGIN", "\"http://127.0.0.1:1421\"")
        }
        release {
            buildConfigField(
                "String",
                "WEBVIEW_URL",
                "\"https://appassets.androidplatform.net/assets/www/index.html\"",
            )
            buildConfigField(
                "String",
                "WEBVIEW_ORIGIN",
                "\"https://appassets.androidplatform.net\"",
            )
            optimization {
                enable = false
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        buildConfig = true
        compose = true
    }
    sourceSets {
        getByName("main") {
            kotlin.directories.add(uniffiSourceDir.absolutePath)
        }
        getByName("debug") {
            jniLibs.directories.add(debugRustDir.absolutePath)
        }
        getByName("release") {
            assets.directories.add(webAssetsDir.absolutePath)
            jniLibs.directories.add(releaseRustDir.absolutePath)
        }
    }
}

val buildRustDebug by tasks.registering(Exec::class) {
    workingDir(workspaceDir)
    inputs.files(rustInputs)
    outputs.dir(debugRustDir)
    commandLine(
        "cargo",
        "ndk",
        "--target",
        "arm64-v8a",
        "--target",
        "x86_64",
        "--platform",
        "29",
        "--output-dir",
        debugRustDir.absolutePath,
        "build",
        "-p",
        "shell360-ffi",
    )
}

val buildRustRelease by tasks.registering(Exec::class) {
    workingDir(workspaceDir)
    inputs.files(rustInputs)
    outputs.dir(releaseRustDir)
    commandLine(
        "cargo",
        "ndk",
        "--target",
        "arm64-v8a",
        "--target",
        "x86_64",
        "--platform",
        "29",
        "--output-dir",
        releaseRustDir.absolutePath,
        "build",
        "-p",
        "shell360-ffi",
        "--release",
    )
}

val buildUniFfiHost by tasks.registering(Exec::class) {
    workingDir(workspaceDir)
    inputs.files(rustInputs)
    outputs.file(hostLibrary)
    commandLine("cargo", "build", "-p", "shell360-ffi")
}

val generateUniFfiBindings by tasks.registering(Exec::class) {
    dependsOn(buildUniFfiHost)
    workingDir(workspaceDir)
    inputs.file(hostLibrary)
    inputs.file(workspaceDir.resolve("crates/shell360-ffi/uniffi.toml"))
    outputs.dir(uniffiSourceDir)
    commandLine(
        "cargo",
        "run",
        "-p",
        "shell360-ffi",
        "--bin",
        "uniffi-bindgen",
        "--",
        "generate",
        "--library",
        hostLibrary.absolutePath,
        "--language",
        "kotlin",
        "--out-dir",
        uniffiSourceDir.absolutePath,
    )
}

val buildMobile by tasks.registering(Exec::class) {
    workingDir(workspaceDir)
    inputs.files(mobileInputs)
    outputs.dir(workspaceDir.resolve("mobile/dist"))
    commandLine("pnpm", "--filter", "mobile", "run", "build")
}

val syncWebAssets by tasks.registering(Sync::class) {
    dependsOn(buildMobile)
    from(workspaceDir.resolve("mobile/dist"))
    into(webAssetsDir.resolve("www"))
}

tasks.configureEach {
    when (name) {
        "compileDebugKotlin", "compileReleaseKotlin" -> dependsOn(generateUniFfiBindings)
        "mergeDebugJniLibFolders", "mergeDebugNativeLibs" -> dependsOn(buildRustDebug)
        "mergeReleaseAssets" -> dependsOn(syncWebAssets)
        "mergeReleaseJniLibFolders", "mergeReleaseNativeLibs" -> dependsOn(buildRustRelease)
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.webkit)
    implementation(libs.jna) {
        artifact {
            type = "aar"
        }
    }
    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
}
