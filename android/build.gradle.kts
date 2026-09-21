// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    alias(libs.plugins.android.application) apply false
    id("com.android.library") version "9.3.1" apply false
    alias(libs.plugins.kotlin.compose) apply false
}
