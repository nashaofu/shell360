package com.nashaofu.shell360.ui.theme

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

enum class ThemeMode(val label: String) {
    System("System"),
    Light("Light"),
    Dark("Dark"),
}

object ThemePreferences {
    var mode: ThemeMode by mutableStateOf(ThemeMode.System)
}
