package com.nashaofu.shell360.ui.theme

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Keeps every margin / padding / gap on the spacing scale of `design/tokens.json`.
 *
 * Before this guard existed the pages mixed 10/12/14/16/20/28 dp side insets and
 * 96 dp bottom padding, which is exactly the drift the token file is meant to stop.
 * Only literals inside a spacing construct are checked, so component sizes such as
 * `size(14.dp)` are not affected.
 */
class SpacingScaleTest {
    private val sourceRoot: File = listOf(
        File("src/main/java/com/nashaofu/shell360"),
        File("app/src/main/java/com/nashaofu/shell360"),
    ).firstOrNull { it.exists() }
        ?: error("Main source root not found from ${File(".").absolutePath}")

    /** 0/1/2 dp are optical nudges (badge insets, hairline gaps), not layout spacing. */
    private val allowed: Set<Int> = SpacingTokens.values.toSet() + setOf(0, 1, 2)

    private val spacingPatterns = listOf(
        Regex("""padding\(([^)]*)\)"""),
        Regex("""spacedBy\(([^)]*)\)"""),
        Regex("""PaddingValues\(([^)]*)\)"""),
        Regex("""Spacer\(Modifier\.(?:height|width)\(([^)]*)\)\)"""),
    )

    private fun spacingLiterals(line: String): List<Int> = spacingPatterns.flatMap { pattern ->
        pattern.findAll(line).flatMap { match ->
            Regex("""(\d+)\.dp""").findAll(match.groupValues[1]).map { it.groupValues[1].toInt() }
        }.toList()
    }

    @Test
    fun everySpacingLiteralIsOnTheTokenScale() {
        val offenders = mutableListOf<String>()

        sourceRoot.walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .forEach { file ->
                file.readLines().forEachIndexed { index, line ->
                    spacingLiterals(line)
                        .filterNot { it in allowed }
                        .forEach { value ->
                            offenders += "${file.name}:${index + 1} uses ${value}.dp"
                        }
                }
            }

        assertTrue(
            "Off-scale spacing values (allowed: ${allowed.sorted()}):\n" + offenders.joinToString("\n"),
            offenders.isEmpty(),
        )
    }
}
