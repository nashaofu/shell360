package com.nashaofu.shell360

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.nashaofu.shell360.ui.theme.Shell360Theme
import com.nashaofu.shell360.ui.theme.ThemePreferences

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val themeMode = ThemePreferences.mode
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
