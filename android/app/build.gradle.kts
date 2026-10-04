plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

val workspaceRoot = projectDir.parentFile.parentFile
val shell360NativeBuild = mapOf("ndkVersion" to "27.3.13750724")
val rustJniRoot = layout.buildDirectory.dir("generated/rustJniLibs")
val uniffiBindingsDir = layout.buildDirectory.dir("generated/uniffi")
val androidSdkRoot = providers.environmentVariable("ANDROID_HOME")
    .orElse(providers.environmentVariable("ANDROID_SDK_ROOT"))
val ndkBin = androidSdkRoot.map { sdk ->
    val os = System.getProperty("os.name").lowercase()
    val hostTag = when {
        os.contains("win") -> "windows-x86_64"
        os.contains("mac") -> if (System.getProperty("os.arch").contains("aarch64")) "darwin-arm64" else "darwin-x86_64"
        else -> if (System.getProperty("os.arch").contains("aarch64")) "linux-aarch64" else "linux-x86_64"
    }
    "$sdk/ndk/${shell360NativeBuild.getValue("ndkVersion")}/toolchains/llvm/prebuilt/$hostTag/bin"
}

android {
    ndkVersion = shell360NativeBuild.getValue("ndkVersion")
    sourceSets["main"].jniLibs.srcDir(rustJniRoot.get().asFile)
}

val buildHostUniFfi = tasks.register<Exec>("buildHostUniFfi") {
    workingDir = workspaceRoot
    commandLine("cargo", "build", "-p", "shell360-ffi")
    outputs.file(workspaceRoot.resolve("target/debug/shell360_ffi${if (System.getProperty("os.name").lowercase().contains("win")) ".dll" else ".so"}"))
}

val generateUniFfiBindings = tasks.register<Exec>("generateUniFfiBindings") {
    dependsOn(buildHostUniFfi)
    workingDir = workspaceRoot
    commandLine(
        "cargo", "run", "-p", "shell360-ffi", "--bin", "uniffi-bindgen", "--",
        "generate", workspaceRoot.resolve("target/debug/shell360_ffi${if (System.getProperty("os.name").lowercase().contains("win")) ".dll" else ".so"}").absolutePath,
        "--language", "kotlin", "--out-dir", uniffiBindingsDir.get().asFile.absolutePath,
        "--no-format",
    )
    outputs.dir(uniffiBindingsDir)
}
tasks.configureEach {
    if (name.startsWith("compile") && name.endsWith("Kotlin")) {
        dependsOn(generateUniFfiBindings)
    }
}
extensions.configure<org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension>("kotlin") {
    sourceSets.getByName("main").kotlin.srcDir(uniffiBindingsDir.get().asFile)
}
val rustJniOutput = layout.buildDirectory.dir("generated/rustJniLibs")

val rustTargets = listOf(
    "arm64-v8a" to "aarch64-linux-android",
    "x86_64" to "x86_64-linux-android",
)
val rustSyncTasks = rustTargets.map { (abi, target) ->
    val buildTask = tasks.register<Exec>("buildRust${abi.replace("-", "_")}") {
        workingDir = workspaceRoot
        commandLine("cargo", "build", "-p", "shell360-ffi", "--target", target)
        val compiler = if (target.startsWith("aarch64")) "aarch64-linux-android29-clang" else "x86_64-linux-android29-clang"
        val targetKey = target.replace('-', '_')
        environment("CC_$targetKey", "${ndkBin.get()}/$compiler.cmd")
        environment("AR_$targetKey", "${ndkBin.get()}/llvm-ar.exe")
        environment("CARGO_TARGET_${targetKey.uppercase()}_LINKER", "${ndkBin.get()}/$compiler.cmd")
        outputs.file(workspaceRoot.resolve("target/$target/debug/libshell360_ffi.so"))
    }
    tasks.register<Sync>("syncRust${abi.replace("-", "_")}") {
        dependsOn(buildTask)
        from(workspaceRoot.resolve("target/$target/debug/libshell360_ffi.so"))
        into(rustJniOutput.map { it.dir(abi) })
    }
}

tasks.named("preBuild").configure {
    dependsOn(generateUniFfiBindings)
    dependsOn(rustSyncTasks)
}
tasks.withType<Exec>().configureEach {
    if (name.startsWith("buildRust")) {
        val target = rustTargets.first { (abi, _) -> name == "buildRust${abi.replace("-", "_")}" }.second
        val targetKey = target.replace('-', '_')
        val compiler = if (target.startsWith("aarch64")) "aarch64-linux-android29-clang" else "x86_64-linux-android29-clang"
        environment("CARGO_TARGET_${targetKey.uppercase()}_LINKER", "${ndkBin.get()}/$compiler.cmd")
    }
}

android {
    namespace = "com.nashaofu.shell360"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "com.nashaofu.shell360"
        minSdk = 29
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
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
        compose = true
    }
}

dependencies {
    implementation("net.java.dev.jna:jna:5.17.0@aar")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.navigation.compose)
    testImplementation(libs.junit)
    testImplementation(libs.json)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
}
