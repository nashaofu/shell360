package com.nashaofu.shell360.ui.theme

import androidx.compose.ui.unit.dp

/** Mirror of `design/tokens.json` (`shape`) — Material 3 baseline corners. */
val ShapeTokens: Map<String, Int> = mapOf(
    "extraSmall" to 4,
    "small" to 8,
    "medium" to 12,
    "large" to 16,
    "extraLarge" to 28,
)

/** Mirror of `design/tokens.json` (`spacing`). */
val SpacingTokens: Map<String, Int> = mapOf(
    "xs" to 4,
    "sm" to 8,
    "md" to 12,
    "lg" to 16,
    "xl" to 24,
    "xxl" to 32,
)

/** Mirror of `design/tokens.json` (`elevation`). */
val ElevationTokens: Map<String, Int> = mapOf(
    "level0" to 0,
    "level1" to 1,
    "level2" to 3,
    "level3" to 6,
)

/** Mirror of `design/tokens.json` (`motion`). */
val MotionTokens: Map<String, Int> = mapOf(
    "short" to 100,
    "medium" to 200,
    "long" to 400,
)

/** Mirror of `design/tokens.json` (`size`) — the only source for control and icon sizes. */
val SizeTokens: Map<String, Int> = mapOf(
    "statusDot" to 8,
    "tableIcon" to 14,
    "buttonIcon" to 18,
    "inlineIcon" to 20,
    "icon" to 24,
    "smallTile" to 32,
    "emptyIcon" to 36,
    "iconTile" to 44,
    "iconButton" to 48,
    "sessionHeader" to 52,
    "emptyIconBox" to 64,
    "emptyCircle" to 88,
    "swipeAction" to 88,
    "keyboardKey" to 34,
    "keyboardToggleWidth" to 38,
    "keyboardToggleHeight" to 26,
    "maskIcon" to 42,
    "maskIconInner" to 30,
    "progressThickness" to 6,
    "controlHeight" to 40,
    "fieldHeight" to 56,
    "chipHeight" to 32,
    "listRow" to 56,
    "sidebarItem" to 48,
    "topBar" to 64,
    "contentMaxWidth" to 960,
    "compactFormMaxWidth" to 480,
    "wideScreenBreakpoint" to 840,
    "sidebarExpandedWidth" to 320,
    "sidebarCollapsedWidth" to 84,
    "sessionSheetMaxHeight" to 520,
    "settingsModeControlWidth" to 200,
    "sftpSizeColumnWidth" to 90,
    "sftpActionColumnWidth" to 96,
    "sftpRowHeight" to 48,
    "sftpIconSlotWidth" to 26,
    "sftpStatusBarHeight" to 28,
    "sftpSearchWidth" to 180,
)

object AppSpacing {
    val xs = SpacingTokens.getValue("xs").dp
    val sm = SpacingTokens.getValue("sm").dp
    val md = SpacingTokens.getValue("md").dp
    val lg = SpacingTokens.getValue("lg").dp
    val xl = SpacingTokens.getValue("xl").dp
    val xxl = SpacingTokens.getValue("xxl").dp
}

/** Named control and icon sizes; use these instead of one-off `.size(N.dp)` literals. */
object AppSizes {
    val statusDot = SizeTokens.getValue("statusDot").dp
    val tableIcon = SizeTokens.getValue("tableIcon").dp
    val buttonIcon = SizeTokens.getValue("buttonIcon").dp
    val inlineIcon = SizeTokens.getValue("inlineIcon").dp
    val icon = SizeTokens.getValue("icon").dp
    val smallTile = SizeTokens.getValue("smallTile").dp
    val emptyIcon = SizeTokens.getValue("emptyIcon").dp
    val iconTile = SizeTokens.getValue("iconTile").dp
    val iconButton = SizeTokens.getValue("iconButton").dp
    val sessionHeader = SizeTokens.getValue("sessionHeader").dp
    val emptyIconBox = SizeTokens.getValue("emptyIconBox").dp
    val emptyCircle = SizeTokens.getValue("emptyCircle").dp
    val swipeAction = SizeTokens.getValue("swipeAction").dp
    val keyboardKey = SizeTokens.getValue("keyboardKey").dp
    val keyboardToggleWidth = SizeTokens.getValue("keyboardToggleWidth").dp
    val keyboardToggleHeight = SizeTokens.getValue("keyboardToggleHeight").dp
    val maskIcon = SizeTokens.getValue("maskIcon").dp
    val maskIconInner = SizeTokens.getValue("maskIconInner").dp
    val progressThickness = SizeTokens.getValue("progressThickness").dp
    val controlHeight = SizeTokens.getValue("controlHeight").dp
    val fieldHeight = SizeTokens.getValue("fieldHeight").dp
    val chipHeight = SizeTokens.getValue("chipHeight").dp
    val listRow = SizeTokens.getValue("listRow").dp
    val sidebarItem = SizeTokens.getValue("sidebarItem").dp
    val topBar = SizeTokens.getValue("topBar").dp
    val contentMaxWidth = SizeTokens.getValue("contentMaxWidth").dp
    val compactFormMaxWidth = SizeTokens.getValue("compactFormMaxWidth").dp
    val wideScreenBreakpoint = SizeTokens.getValue("wideScreenBreakpoint").dp
    val sidebarExpandedWidth = SizeTokens.getValue("sidebarExpandedWidth").dp
    val sidebarCollapsedWidth = SizeTokens.getValue("sidebarCollapsedWidth").dp
    val sessionSheetMaxHeight = SizeTokens.getValue("sessionSheetMaxHeight").dp
    val settingsModeControlWidth = SizeTokens.getValue("settingsModeControlWidth").dp
    val sftpSizeColumnWidth = SizeTokens.getValue("sftpSizeColumnWidth").dp
    val sftpActionColumnWidth = SizeTokens.getValue("sftpActionColumnWidth").dp
    val sftpRowHeight = SizeTokens.getValue("sftpRowHeight").dp
    val sftpIconSlotWidth = SizeTokens.getValue("sftpIconSlotWidth").dp
    val sftpStatusBarHeight = SizeTokens.getValue("sftpStatusBarHeight").dp
    val sftpSearchWidth = SizeTokens.getValue("sftpSearchWidth").dp
}
