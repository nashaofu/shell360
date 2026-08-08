import com.nashaofu.shell360.gradle.BuildAndroidRustLibraryTask
import com.nashaofu.shell360.gradle.GenerateUniFfiBindingsTask
import com.nashaofu.shell360.gradle.Shell360AndroidNativeBuildExtension

val shell360NativeBuild = extensions.create<Shell360AndroidNativeBuildExtension>(
    "shell360NativeBuild",
)
val workspaceRoot = rootProject.projectDir.parentFile
val mobileDistDir = workspaceRoot.resolve("mobile/dist")

val rustLibraryName = "libshell360_ffi.so"
val isWindows = System.getProperty("os.name").contains("Windows", ignoreCase = true)

data class AndroidRustTarget(
    val taskSuffix: String,
    val abi: String,
    val triple: String,
)

val androidRustTargets = listOf(
    AndroidRustTarget("Arm64", "arm64-v8a", "aarch64-linux-android"),
    AndroidRustTarget("X86_64", "x86_64", "x86_64-linux-android"),
)

fun registerRustBuildTasks(
    variantName: String,
    outputDir: Provider<Directory>,
    release: Boolean,
): TaskProvider<Task> {
    val buildTasks = androidRustTargets.mapIndexed { index, target ->
        val cargoProfile = if (release) "release" else "debug"
        val cargoOutput = workspaceRoot.resolve(
            "target/${target.triple}/$cargoProfile/$rustLibraryName",
        )
        val buildTask = tasks.register<BuildAndroidRustLibraryTask>(
            "buildRust$variantName${target.taskSuffix}",
        ) {
            androidHome.set(providers.environmentVariable("ANDROID_HOME"))
            ndkVersion.set(shell360NativeBuild.ndkVersion)
            androidApiLevel.set(shell360NativeBuild.androidApiLevel)
            targetTriple.set(target.triple)
            releaseBuild.set(release)
            workspaceDir.fileValue(workspaceRoot)
            outputLibrary.fileValue(cargoOutput)
            // Cargo builds share the workspace target directory, so keep host and ABI builds serialized.
            mustRunAfter("generateUniFfiBindings")
            if (index > 0) {
                mustRunAfter(
                    "buildRust$variantName${androidRustTargets[index - 1].taskSuffix}",
                )
            }
        }

        tasks.register<Sync>("syncRust$variantName${target.taskSuffix}") {
            dependsOn(buildTask)
            from(cargoOutput)
            into(outputDir.map { it.dir(target.abi) })
            include(rustLibraryName)
        }
    }

    return tasks.register("buildRust$variantName") {
        dependsOn(buildTasks)
    }
}

val buildRustDebug = registerRustBuildTasks(
    "Debug",
    shell360NativeBuild.debugRustDir,
    release = false,
)
val buildRustRelease = registerRustBuildTasks(
    "Release",
    shell360NativeBuild.releaseRustDir,
    release = true,
)

val generateUniFfiBindings = tasks.register<GenerateUniFfiBindingsTask>("generateUniFfiBindings") {
    workspaceDir.set(workspaceRoot)
    configFile.fileValue(workspaceRoot.resolve("crates/shell360-ffi/uniffi.toml"))
    outputDir.set(shell360NativeBuild.uniFfiSourceDir)
}

val buildMobile = tasks.register<Exec>("buildMobile") {
    workingDir(workspaceRoot)
    inputs.dir(workspaceRoot.resolve("mobile/src"))
    inputs.dir(workspaceRoot.resolve("mobile/public"))
    inputs.dir(workspaceRoot.resolve("bridge/src"))
    inputs.dir(workspaceRoot.resolve("shared/src"))
    inputs.files(
        workspaceRoot.resolve("mobile/index.html"),
        workspaceRoot.resolve("mobile/package.json"),
        workspaceRoot.resolve("mobile/rsbuild.config.ts"),
        workspaceRoot.resolve("mobile/tsconfig.json"),
        workspaceRoot.resolve("bridge/package.json"),
        workspaceRoot.resolve("bridge/tsconfig.json"),
        workspaceRoot.resolve("shared/package.json"),
        workspaceRoot.resolve("shared/tsconfig.json"),
        workspaceRoot.resolve("pnpm-lock.yaml"),
        workspaceRoot.resolve("pnpm-workspace.yaml"),
    )
    outputs.dir(mobileDistDir)

    val pnpmArguments = buildList {
        if (isWindows) {
            add("pnpm.cmd")
        } else {
            add("pnpm")
        }
        add("--filter")
        add("mobile")
        add("run")
        add("build")
    }

    commandLine(pnpmArguments)
}

val syncWebAssets = tasks.register<Sync>("syncWebAssets") {
    dependsOn(buildMobile)
    from(mobileDistDir)
    into(shell360NativeBuild.webAssetsDir)
}

tasks.configureEach {
    // Attach generated sources and native artifacts to the Android lifecycle tasks that consume them.
    when (name) {
        "compileDebugKotlin", "compileReleaseKotlin" -> dependsOn(generateUniFfiBindings)
        "mergeDebugJniLibFolders", "mergeDebugNativeLibs" -> dependsOn(buildRustDebug)
        "mergeReleaseJniLibFolders", "mergeReleaseNativeLibs" -> dependsOn(buildRustRelease)
        "generateReleaseLintVitalReportModel", "lintVitalAnalyzeRelease", "mergeReleaseAssets" -> dependsOn(syncWebAssets)
    }
}
