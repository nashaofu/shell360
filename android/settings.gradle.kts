pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "Shell360"
include(":app")
include(":terminal-emulator")
include(":terminal-view")

project(":terminal-emulator").projectDir = file("third_party/termux-app/terminal-emulator")
project(":terminal-view").projectDir = file("third_party/termux-app/terminal-view")
