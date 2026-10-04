package com.nashaofu.shell360.ui.theme

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Enforces one size per role. Before this guard the UI mixed 36/44/48 dp icon buttons
 * and 16/18/20/22/24 dp icons, so some buttons looked larger than others on the same
 * screen. Only literals inside `Modifier.size(...)` are checked, so widths, heights and
 * shapes are unaffected.
 */
class ComponentSizeTest {
    private val sourceRoot: File = listOf(
        File("src/main/java/com/nashaofu/shell360"),
        File("app/src/main/java/com/nashaofu/shell360"),
    ).firstOrNull { it.exists() }
        ?: error("Main source root not found from ${File(".").absolutePath}")

    private val allowed: Set<Int> = SizeTokens.values.toSet()

    private val sizePattern = Regex("""\.size\((\d+)\.dp\)""")

    @Test
    fun everySizeLiteralIsARegisteredToken() {
        val offenders = mutableListOf<String>()

        sourceRoot.walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .forEach { file ->
                file.readLines().forEachIndexed { index, line ->
                    sizePattern.findAll(line).forEach { match ->
                        val value = match.groupValues[1].toInt()
                        if (value !in allowed) {
                            offenders += "${file.name}:${index + 1} uses ${value}.dp"
                        }
                    }
                }
            }

        assertTrue(
            "Unregistered size literals (allowed: ${allowed.sorted()}):\n" + offenders.joinToString("\n"),
            offenders.isEmpty(),
        )
    }
}
