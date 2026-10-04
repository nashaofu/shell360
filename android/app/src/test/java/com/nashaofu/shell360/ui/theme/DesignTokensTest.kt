package com.nashaofu.shell360.ui.theme

import androidx.compose.ui.graphics.Color
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * Enforces the cross-platform contract: every value here must equal
 * `design/tokens.json`. When iOS or HarmonyOS lands its native UI, copy this test
 * shape so the three platforms stay provably in sync.
 */
class DesignTokensTest {
    private val root: JSONObject by lazy {
        JSONObject(tokensFile().readText())
    }

    private fun tokensFile(): File {
        val candidates = listOf(
            File("../../design/tokens.json"),
            File("../design/tokens.json"),
            File("design/tokens.json"),
        )
        return candidates.firstOrNull { it.exists() }
            ?: error("design/tokens.json not found from ${File(".").absolutePath}")
    }

    @Test
    fun lightColorRolesMatchDesignSource() {
        assertColorRoles(root.getJSONObject("color").getJSONObject("light"), LightColorTokens, "light")
    }

    @Test
    fun darkColorRolesMatchDesignSource() {
        assertColorRoles(root.getJSONObject("color").getJSONObject("dark"), DarkColorTokens, "dark")
    }

    @Test
    fun typographyMatchesDesignSource() {
        val json = root.getJSONObject("typography")
        val keys = json.keys().asSequence().toSet()
        assertEquals("typography role set", keys, TypeTokens.keys)

        for (key in keys) {
            val item = json.getJSONObject(key)
            val expected = TypeToken(
                size = item.getInt("size"),
                lineHeight = item.getInt("lineHeight"),
                letterSpacing = item.getDouble("letterSpacing"),
                weight = item.getInt("weight"),
            )
            assertEquals("typography $key", expected, TypeTokens.getValue(key))
        }
    }

    @Test
    fun shapeAndSpacingMatchDesignSource() {
        assertIntMap(root.getJSONObject("shape"), ShapeTokens, "shape")
        assertIntMap(root.getJSONObject("spacing"), SpacingTokens, "spacing")
        assertIntMap(root.getJSONObject("size"), SizeTokens, "size")
        assertIntMap(root.getJSONObject("elevation"), ElevationTokens, "elevation")
        assertIntMap(root.getJSONObject("motion"), MotionTokens, "motion")
    }

    private fun assertColorRoles(json: JSONObject, tokens: Map<String, Color>, label: String) {
        val keys = json.keys().asSequence().toSet()
        assertEquals("$label color role set", keys, tokens.keys)

        for (key in keys) {
            assertEquals("$label color $key", parseHex(json.getString(key)), tokens.getValue(key))
        }
    }

    private fun assertIntMap(json: JSONObject, tokens: Map<String, Int>, label: String) {
        val keys = json.keys().asSequence().toSet()
        assertEquals("$label key set", keys, tokens.keys)

        for (key in keys) {
            assertEquals("$label $key", json.getInt(key), tokens.getValue(key))
        }
    }

    private fun parseHex(value: String): Color {
        val hex = value.removePrefix("#")
        return when (hex.length) {
            6 -> Color(("FF$hex").toLong(16))
            8 -> Color(hex.toLong(16))
            else -> error("Unsupported colour literal: $value")
        }
    }
}
