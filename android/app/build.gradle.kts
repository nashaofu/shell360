import com.nashaofu.shell360.gradle.Shell360AndroidNativeBuildExtension
import groovy.json.JsonSlurper

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    id("shell360.android.native-build")
}

val debugWebViewHost = providers
    .gradleProperty("devServerHost")
    .orElse("127.0.0.1")
    .get()
val debugWebViewPort = providers
    .gradleProperty("devServerPort")
    .orElse("1421")
    .get()
val debugWebViewUrl = "http://$debugWebViewHost:$debugWebViewPort"

val releaseWebViewOrigin = "https://appassets.androidplatform.net"
val signingStoreFile = providers
    .environmentVariable("SIGNING_STORE_FILE")
    .orNull
val signingStorePassword = providers
    .environmentVariable("SIGNING_STORE_PASSWORD")
    .orNull
val signingKeyPassword = providers
    .environmentVariable("SIGNING_KEY_PASSWORD")
    .orNull

val tauriConfig = rootProject.file("../src-tauri/tauri.conf.json")
val tauriConfigJson = JsonSlurper().parse(tauriConfig) as? Map<*, *>
    ?: error("Invalid JSON in ${tauriConfig.path}")
val tauriVersion = tauriConfigJson["version"] as? String
    ?: error("Unable to read version from ${tauriConfig.path}")
val tauriVersionParts = tauriVersion
    .substringBefore('-')
    .split('.')
    .map { it.toIntOrNull() ?: error("Invalid Tauri version: $tauriVersion") }

val androidVersionCode = tauriVersionParts[0] * 1_000_000 +
    tauriVersionParts[1] * 1_000 +
    tauriVersionParts[2]

fun String.asBuildConfigString() = "\"$this\""

shell360NativeBuild {
    ndkVersion.set("30.0.15729638")
    androidApiLevel.set(29)
    uniFfiSourceDir.set(layout.buildDirectory.dir("generated/source/uniffi"))
    debugRustDir.set(layout.buildDirectory.dir("generated/rust/debug/jniLibs"))
    releaseRustDir.set(layout.buildDirectory.dir("generated/rust/release/jniLibs"))
    webAssetsDir.set(layout.buildDirectory.dir("generated/webAssets"))
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
        minSdk = shell360NativeBuild.androidApiLevel.get()
        targetSdk = 36
        versionCode = androidVersionCode
        versionName = tauriVersion

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    signingConfigs {
        create("release") {
            storeFile = signingStoreFile?.let(::file)
            storePassword = signingStorePassword
            keyAlias = "upload"
            keyPassword = signingKeyPassword
        }
    }
    buildTypes {
        debug {
            buildConfigField("String", "WEBVIEW_URL", debugWebViewUrl.asBuildConfigString())
            buildConfigField("String", "WEBVIEW_ORIGIN", debugWebViewUrl.asBuildConfigString())
        }
        release {
            buildConfigField(
                "String",
                "WEBVIEW_URL",
                "$releaseWebViewOrigin/index.html".asBuildConfigString(),
            )
            buildConfigField(
                "String",
                "WEBVIEW_ORIGIN",
                releaseWebViewOrigin.asBuildConfigString(),
            )
            signingConfig = signingConfigs.getByName("release")
            optimization {
                enable = true
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
            kotlin.directories.add(shell360NativeBuild.uniFfiSourceDir.get().asFile.absolutePath)
        }
        getByName("debug") {
            jniLibs.directories.add(shell360NativeBuild.debugRustDir.get().asFile.absolutePath)
        }
        getByName("release") {
            jniLibs.directories.add(shell360NativeBuild.releaseRustDir.get().asFile.absolutePath)
            assets.directories.add(shell360NativeBuild.webAssetsDir.get().asFile.absolutePath)
        }
    }
    ndkVersion = shell360NativeBuild.ndkVersion.get()
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.webkit)
    implementation(libs.jna) {
        artifact {
            type = "aar"
        }
    }
    androidTestImplementation(libs.androidx.junit)
}
