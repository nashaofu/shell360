plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    id("shell360.android.native-build")
}

val generatedDir = layout.buildDirectory.dir("generated").get().asFile
val uniffiSourceDir = generatedDir.resolve("source/uniffi")
val debugRustDir = generatedDir.resolve("rust/debug/jniLibs")
val releaseRustDir = generatedDir.resolve("rust/release/jniLibs")
val webAssetsDir = generatedDir.resolve("webAssets")
val debugWebViewOrigin = "http://127.0.0.1:1421"
val releaseWebViewOrigin = "https://appassets.androidplatform.net"

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
        minSdk = 29
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
    ndkVersion = "30.0.15729638 rc2"
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
