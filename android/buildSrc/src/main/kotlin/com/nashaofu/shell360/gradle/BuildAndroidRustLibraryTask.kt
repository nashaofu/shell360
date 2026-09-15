package com.nashaofu.shell360.gradle

import java.io.File
import javax.inject.Inject
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.provider.Property
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.OutputFile
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.process.ExecOperations

abstract class BuildAndroidRustLibraryTask @Inject constructor(
    private val execOperations: ExecOperations,
) : DefaultTask() {
    init {
        val workspaceRoot = project.rootProject.projectDir.parentFile
        rustSources.from(workspaceRoot.resolve("crates"))
        cargoManifest.fileValue(workspaceRoot.resolve("Cargo.toml"))
        cargoLock.fileValue(workspaceRoot.resolve("Cargo.lock"))
    }

    @get:Input
    abstract val androidHome: Property<String>

    @get:Input
    abstract val ndkVersion: Property<String>

    @get:Input
    abstract val androidApiLevel: Property<Int>

    @get:Input
    abstract val targetTriple: Property<String>

    @get:Input
    abstract val releaseBuild: Property<Boolean>

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val rustSources: ConfigurableFileCollection

    @get:InputFile
    abstract val cargoManifest: RegularFileProperty

    @get:InputFile
    abstract val cargoLock: RegularFileProperty

    @get:Internal
    abstract val workspaceDir: DirectoryProperty

    @get:OutputFile
    abstract val outputLibrary: RegularFileProperty

    @TaskAction
    fun build() {
        val target = targetTriple.get()
        val version = ndkVersion.get()
        val androidNdkHome = File(androidHome.get()).resolve("ndk/$version")
        if (!androidNdkHome.isDirectory) {
            throw GradleException(
                "NDK $version is not installed: $androidNdkHome",
            )
        }
        val ndkToolchainBinDir = resolveNdkToolchainPath()
        if (!ndkToolchainBinDir.isDirectory) {
            throw GradleException(
                "NDK $version does not contain a toolchain: $ndkToolchainBinDir",
            )
        }

        val compilerEnvironmentKey = target.replace('-', '_')
        val linkerEnvironmentKey = compilerEnvironmentKey.uppercase()
        val apiLevel = androidApiLevel.get()
        val clang = resolveNdkToolchainExecutablePath(
            ndkToolchainBinDir,
            "$target${apiLevel}-clang",
            ".cmd",
        )
        val clangPlusPlus = resolveNdkToolchainExecutablePath(
            ndkToolchainBinDir,
            "$target${apiLevel}-clang++",
            ".cmd",
        )
        val llvmAr = resolveNdkToolchainExecutablePath(
            ndkToolchainBinDir,
            "llvm-ar",
            ".exe",
        )
        listOf(clang, clangPlusPlus, llvmAr).firstOrNull { !it.isFile }?.let { missing ->
            throw GradleException("NDK toolchain executable is missing: $missing")
        }

        val cargoArguments = buildList {
            add("cargo")
            add("build")
            add("--target")
            add(target)
            add("-p")
            add("shell360-ffi")

            if (releaseBuild.get()) {
                add("--release")
            }
        }
        execOperations.exec {
            workingDir(workspaceDir.get().asFile)
            environment(
                mapOf(
                    "CARGO_TARGET_${linkerEnvironmentKey}_LINKER" to clang.absolutePath,
                    "CC_$compilerEnvironmentKey" to clang.absolutePath,
                    "CXX_$compilerEnvironmentKey" to clangPlusPlus.absolutePath,
                    "AR_$compilerEnvironmentKey" to llvmAr.absolutePath,
                ),
            )
            commandLine(cargoArguments)
        }
    }

    private fun resolveNdkToolchainPath(): File {
        val androidNdkHome = File(androidHome.get()).resolve("ndk/${ndkVersion.get()}")

        val osName = System.getProperty("os.name").lowercase()
        val normalizedOsName = when {
            osName.contains("windows") -> "windows"
            osName.contains("mac") -> "darwin"
            osName.contains("linux") -> "linux"
            else -> throw GradleException("Unsupported host operating system: $osName")
        }

        val architecture = System.getProperty("os.arch").lowercase()
        val normalizedArchitecture = when (architecture) {
            "amd64", "x86_64" -> "x86_64"
            "aarch64", "arm64" -> "aarch64"
            else -> throw GradleException("Unsupported host architecture: $architecture")
        }

        return androidNdkHome.resolve(
            "toolchains/llvm/prebuilt/$normalizedOsName-$normalizedArchitecture/bin",
        )
    }
}

private fun resolveNdkToolchainExecutablePath(
    toolchainBinDir: File,
    executableName: String,
    windowsSuffix: String,
): File {
    val osName = System.getProperty("os.name").lowercase()

    val executableFileName = if (osName.contains("windows")) {
        "$executableName$windowsSuffix"
    } else {
        executableName
    }
    return toolchainBinDir.resolve(executableFileName)
}
