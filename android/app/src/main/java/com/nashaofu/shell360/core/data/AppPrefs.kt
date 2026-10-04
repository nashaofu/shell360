package com.nashaofu.shell360.core.data

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit

/**
 * Small persistence boundary for settings that must survive a restart. The same
 * object is the natural home for the bridge-backed store once it replaces the
 * in-memory collections.
 */
object AppPrefs {
    private const val FILE_NAME = "shell360.settings"
    private const val KEY_THEME_MODE = "theme_mode"

    private var prefs: SharedPreferences? = null

    fun init(context: Context) {
        prefs = context.applicationContext.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)
        prefs?.edit {
            remove("crypto_enabled")
            remove("crypto_password")
        }
    }

    val themeModeName: String
        get() = prefs?.getString(KEY_THEME_MODE, "").orEmpty()

    fun setThemeMode(name: String) {
        prefs?.edit { putString(KEY_THEME_MODE, name) }
    }
}
