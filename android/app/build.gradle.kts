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
    fileTree(workspaceDir.resolve("crates/shell360-store")) {
        include("Cargo.toml", "**/*.rs")
    },
    fileTree(workspaceDir.resolve("crates/shell360-ssh")) {
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
val androidLibraryName = "libshell360_ffi.so"
val androidNdkHome =
    System.getenv("NDK_HOME")
        ?: System.getenv("ANDROID_NDK_HOME")
        ?: throw GradleException("Set the NDK_HOME or ANDROID_NDK_HOME environment variable")
val ndkHostTag = when {
    hostOperatingSystem.contains("windows") -> "windows-x86_64"
    hostOperatingSystem.contains("mac") && System.getProperty("os.arch").contains("aarch64") ->
        "darwin-aarch64"
    hostOperatingSystem.contains("mac") -> "darwin-x86_64"
    else -> "linux-x86_64"
}
val ndkBinDir = file("$androidNdkHome/toolchains/llvm/prebuilt/$ndkHostTag/bin")

data class AndroidRustTarget(
    val taskName: String,
    val abi: String,
    val triple: String,
    val clangPrefix: String,
)

val androidRustTargets = listOf(
    AndroidRustTarget("Arm64", "arm64-v8a", "aarch64-linux-android", "aarch64-linux-android"),
    AndroidRustTarget("X86_64", "x86_64", "x86_64-linux-android", "x86_64-linux-android"),
)

fun ndkExecutable(name: String): File =
    ndkBinDir.resolve(if (hostOperatingSystem.contains("windows")) "$name.cmd" else name)

fun registerRustBuild(
    variant: String,
    outputDir: File,
    release: Boolean,
) = androidRustTargets.map { target ->
    val cargoOutput = workspaceDir.resolve(
        "target/${target.triple}/${if (release) "release" else "debug"}/$androidLibraryName",
    )
    val buildTask = tasks.register<Exec>("buildRust${variant}${target.taskName}") {
        workingDir(workspaceDir)
        inputs.files(rustInputs)
        outputs.file(cargoOutput)
        environment(
            "CARGO_TARGET_${target.triple.uppercase().replace('-', '_')}_LINKER",
            ndkExecutable("${target.clangPrefix}29-clang").absolutePath,
        )
        environment(
            "CC_${target.triple.replace('-', '_')}",
            ndkExecutable("${target.clangPrefix}29-clang").absolutePath,
        )
        environment(
            "CXX_${target.triple.replace('-', '_')}",
            ndkExecutable("${target.clangPrefix}29-clang++").absolutePath,
        )
        environment(
            "AR_${target.triple.replace('-', '_')}",
            ndkExecutable("llvm-ar").absolutePath,
        )
        commandLine(
            "cargo",
            "build",
            "--target",
            target.triple,
            "-p",
            "shell360-ffi",
            *(if (release) arrayOf("--release") else emptyArray()),
        )
    }

    tasks.register<Sync>("syncRust${variant}${target.taskName}") {
        dependsOn(buildTask)
        from(cargoOutput)
        into(outputDir.resolve(target.abi))
        include(androidLibraryName)
    }
}

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

val buildRustDebugTargets = registerRustBuild("Debug", debugRustDir, release = false)
val buildRustReleaseTargets = registerRustBuild("Release", releaseRustDir, release = true)

val buildRustDebug by tasks.registering {
    dependsOn(buildRustDebugTargets)
}

val buildRustRelease by tasks.registering {
    dependsOn(buildRustReleaseTargets)
}

val buildUniFfiHost by tasks.registering(Exec::class) {
    workingDir(workspaceDir)
    inputs.files(rustInputs)
    outputs.file(hostLibrary)
    commandLine("cargo", "build", "-p", "shell360-ffi")
}

tasks.named("buildRustDebugArm64") {
    mustRunAfter(buildUniFfiHost)
}
tasks.named("buildRustDebugX86_64") {
    mustRunAfter("buildRustDebugArm64")
}
tasks.named("buildRustReleaseArm64") {
    mustRunAfter(buildUniFfiHost)
}
tasks.named("buildRustReleaseX86_64") {
    mustRunAfter("buildRustReleaseArm64")
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
        "generateReleaseLintVitalReportModel", "lintVitalAnalyzeRelease", "mergeReleaseAssets" -> dependsOn(syncWebAssets)
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
