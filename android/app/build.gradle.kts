plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

val workspaceDir = rootProject.projectDir.parentFile
val generatedDir = layout.buildDirectory.dir("generated").get().asFile
val uniffiSourceDir = generatedDir.resolve("source/uniffi")
val debugRustDir = generatedDir.resolve("rust/debug/jniLibs")
val releaseRustDir = generatedDir.resolve("rust/release/jniLibs")
val webAssetsDir = generatedDir.resolve("webAssets")
val mobileDistDir = workspaceDir.resolve("mobile/dist")

val androidApiLevel = 29
val androidLibraryName = "libshell360_ffi.so"
val debugWebViewOrigin = "http://127.0.0.1:1421"
val releaseWebViewOrigin = "https://appassets.androidplatform.net"

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
val hostLibrary = workspaceDir.resolve(
    "target/debug/${when {
        hostOperatingSystem.contains("mac") -> "libshell360_ffi.dylib"
        hostOperatingSystem.contains("windows") -> "shell360_ffi.dll"
        else -> "libshell360_ffi.so"
    }}",
)
val androidNdkHome = providers.environmentVariable("NDK_HOME").orNull?.let(::file)
    ?: throw GradleException("Set the NDK_HOME environment variable")
if (!androidNdkHome.isDirectory) {
    throw GradleException("NDK_HOME does not point to an existing directory: $androidNdkHome")
}
val ndkHostTag = when {
    hostOperatingSystem.contains("windows") -> "windows-x86_64"
    hostOperatingSystem.contains("mac") && System.getProperty("os.arch").contains("aarch64") ->
        "darwin-aarch64"
    hostOperatingSystem.contains("mac") -> "darwin-x86_64"
    else -> "linux-x86_64"
}
val ndkBinDir = file("$androidNdkHome/toolchains/llvm/prebuilt/$ndkHostTag/bin")

data class AndroidRustTarget(
    val name: String,
    val abi: String,
    val triple: String,
) {
    val environmentKey = triple.uppercase().replace('-', '_')
    val compilerEnvironmentKey = triple.replace('-', '_')
}

data class AndroidRustBuildTasks(
    val build: TaskProvider<Exec>,
    val sync: TaskProvider<Sync>,
)

val androidRustTargets = listOf(
    AndroidRustTarget("Arm64", "arm64-v8a", "aarch64-linux-android"),
    AndroidRustTarget("X86_64", "x86_64", "x86_64-linux-android"),
)

fun ndkExecutable(name: String): File =
    ndkBinDir.resolve(if (hostOperatingSystem.contains("windows")) "$name.cmd" else name)

fun registerRustBuildTasks(
    variantName: String,
    outputDir: File,
    release: Boolean,
) = androidRustTargets.map { target ->
    val cargoOutput = workspaceDir.resolve(
        "target/${target.triple}/${if (release) "release" else "debug"}/$androidLibraryName",
    )
    val clang = ndkExecutable("${target.triple}$androidApiLevel-clang")
    val buildTask = tasks.register<Exec>("buildRust$variantName${target.name}") {
        workingDir(workspaceDir)
        inputs.files(rustInputs)
        outputs.file(cargoOutput)
        environment(
            mapOf(
                "CARGO_TARGET_${target.environmentKey}_LINKER" to clang.absolutePath,
                "CC_${target.compilerEnvironmentKey}" to clang.absolutePath,
                "CXX_${target.compilerEnvironmentKey}" to
                    ndkExecutable("${target.triple}$androidApiLevel-clang++").absolutePath,
                "AR_${target.compilerEnvironmentKey}" to ndkExecutable("llvm-ar").absolutePath,
            ),
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

    val syncTask = tasks.register<Sync>("syncRust$variantName${target.name}") {
        dependsOn(buildTask)
        from(cargoOutput)
        into(outputDir.resolve(target.abi))
        include(androidLibraryName)
    }

    AndroidRustBuildTasks(buildTask, syncTask)
}

fun String.asBuildConfigString() = "\"$this\""

android {
    namespace = "com.nashaofu.shell360"
    compileSdk {
        version = release(37) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "com.nashaofu.shell360"
        minSdk = androidApiLevel
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        debug {
            buildConfigField("String", "WEBVIEW_URL", debugWebViewOrigin.asBuildConfigString())
            buildConfigField("String", "WEBVIEW_ORIGIN", debugWebViewOrigin.asBuildConfigString())
        }
        release {
            buildConfigField(
                "String",
                "WEBVIEW_URL",
                "$releaseWebViewOrigin/assets/www/index.html".asBuildConfigString(),
            )
            buildConfigField(
                "String",
                "WEBVIEW_ORIGIN",
                releaseWebViewOrigin.asBuildConfigString(),
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

val buildUniFfiHost by tasks.registering(Exec::class) {
    workingDir(workspaceDir)
    inputs.files(rustInputs)
    outputs.file(hostLibrary)
    commandLine("cargo", "build", "-p", "shell360-ffi")
}

val buildRustDebugTargets = registerRustBuildTasks("Debug", debugRustDir, release = false)
val buildRustReleaseTargets = registerRustBuildTasks("Release", releaseRustDir, release = true)
val (rustDebugArm64, rustDebugX86_64) = buildRustDebugTargets
val (rustReleaseArm64, rustReleaseX86_64) = buildRustReleaseTargets

rustDebugArm64.build.configure {
    mustRunAfter(buildUniFfiHost)
}
rustDebugX86_64.build.configure {
    mustRunAfter(rustDebugArm64.build)
}
rustReleaseArm64.build.configure {
    mustRunAfter(buildUniFfiHost)
}
rustReleaseX86_64.build.configure {
    mustRunAfter(rustReleaseArm64.build)
}

val buildRustDebug by tasks.registering {
    dependsOn(buildRustDebugTargets.map { it.sync })
}

val buildRustRelease by tasks.registering {
    dependsOn(buildRustReleaseTargets.map { it.sync })
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
    outputs.dir(mobileDistDir)
    commandLine("pnpm", "--filter", "mobile", "run", "build")
}

val syncWebAssets by tasks.registering(Sync::class) {
    dependsOn(buildMobile)
    from(mobileDistDir)
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
