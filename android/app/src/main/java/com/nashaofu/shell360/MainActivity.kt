package com.nashaofu.shell360

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.lifecycleScope
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.tooling.preview.Preview
import androidx.core.view.WindowCompat
import com.nashaofu.shell360.core.data.AppPrefs
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import com.nashaofu.shell360.ui.theme.Shell360Theme
import com.nashaofu.shell360.ui.theme.ThemeMode
import com.nashaofu.shell360.ui.theme.ThemePreferences

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        AppPrefs.init(this)
        lifecycle.addObserver(LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) AndroidRuntime.lock()
            if (event == Lifecycle.Event.ON_DESTROY && isFinishing) AndroidRuntime.close()
        })
        if (!Shell360Store.initialized) {
            Shell360Store.initialized = true
            ThemePreferences.mode = ThemeMode.entries
                .firstOrNull { it.name == AppPrefs.themeModeName }
                ?: ThemeMode.System
        }
        lifecycleScope.launchWhenCreated {
            AndroidRuntime.start(applicationContext)
        }

        enableEdgeToEdge()
        setContent {
            val themeMode = ThemePreferences.mode
            val dark = when (themeMode) {
                ThemeMode.System -> isSystemInDarkTheme()
                ThemeMode.Light -> false
                ThemeMode.Dark -> true
            }

            // enableEdgeToEdge() picks the status/navigation bar icon contrast from the
            // *system* dark mode. The app theme is independent, so an explicit Light or
            // Dark choice would otherwise leave the icons invisible against the bars.
            LaunchedEffect(dark) {
                WindowCompat.getInsetsController(window, window.decorView).apply {
                    isAppearanceLightStatusBars = !dark
                    isAppearanceLightNavigationBars = !dark
                }
            }

            Shell360Theme(themeMode = themeMode) {
                Shell360Navigation()
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
fun Shell360NavigationPreview() {
    Shell360Theme(themeMode = ThemePreferences.mode) {
        Shell360Navigation()
    }
}
