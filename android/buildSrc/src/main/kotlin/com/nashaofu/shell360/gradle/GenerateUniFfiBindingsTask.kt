package com.nashaofu.shell360.gradle

import javax.inject.Inject
import org.gradle.api.DefaultTask
import org.gradle.api.file.ConfigurableFileCollection
import org.gradle.api.file.DirectoryProperty
import org.gradle.api.file.RegularFileProperty
import org.gradle.api.tasks.Internal
import org.gradle.api.tasks.InputFile
import org.gradle.api.tasks.OutputDirectory
import org.gradle.api.tasks.InputFiles
import org.gradle.api.tasks.PathSensitive
import org.gradle.api.tasks.PathSensitivity
import org.gradle.api.tasks.TaskAction
import org.gradle.process.ExecOperations

abstract class GenerateUniFfiBindingsTask @Inject constructor(
    private val execOperations: ExecOperations,
) : DefaultTask() {
    init {
        val workspaceRoot = project.rootProject.projectDir.parentFile
        rustSources.from(workspaceRoot.resolve("crates"))
        cargoManifest.fileValue(workspaceRoot.resolve("Cargo.toml"))
        cargoLock.fileValue(workspaceRoot.resolve("Cargo.lock"))
    }

    @get:Internal
    abstract val workspaceDir: DirectoryProperty

    @get:InputFile
    abstract val configFile: RegularFileProperty

    @get:InputFiles
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val rustSources: ConfigurableFileCollection

    @get:InputFile
    abstract val cargoManifest: RegularFileProperty

    @get:InputFile
    abstract val cargoLock: RegularFileProperty

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun generate() {
        val cargoBuildArguments = buildList {
            add("cargo")
            add("build")
            add("-p")
            add("shell360-ffi")
        }
        execOperations.exec {
            workingDir(workspaceDir.get().asFile)
            commandLine(cargoBuildArguments)
        }

        val cargoBindgenArguments = buildList {
            add("cargo")
            add("run")
            add("-p")
            add("shell360-ffi")
            add("--bin")
            add("uniffi-bindgen")
            add("--")
            add("generate")
            add("--library")
            add(resolveHostLibraryDir().absolutePath)
            add("--language")
            add("kotlin")
            add("--out-dir")
            add(outputDir.get().asFile.absolutePath)
        }
        execOperations.exec {
            workingDir(workspaceDir.get().asFile)
            commandLine(cargoBindgenArguments)
        }
    }

    private fun resolveHostLibraryDir(): java.io.File {
        val osName = System.getProperty("os.name").lowercase()
        val libraryName = when {
            osName.contains("windows", ignoreCase = true) -> "shell360_ffi.dll"
            osName.contains("mac", ignoreCase = true) -> "libshell360_ffi.dylib"
            else -> "libshell360_ffi.so"
        }
        return workspaceDir.get().asFile.resolve("target/debug/$libraryName")
    }
}
