package com.nashaofu.shell360.gradle

import org.gradle.api.file.DirectoryProperty
import org.gradle.api.provider.Property

abstract class Shell360AndroidNativeBuildExtension {
    abstract val ndkVersion: Property<String>
    abstract val androidApiLevel: Property<Int>
    abstract val uniFfiSourceDir: DirectoryProperty
    abstract val debugRustDir: DirectoryProperty
    abstract val releaseRustDir: DirectoryProperty
    abstract val webAssetsDir: DirectoryProperty
}
