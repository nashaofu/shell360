package com.nashaofu.shell360.feature.workspace

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Terminal
import com.nashaofu.shell360.ui.components.AppButton
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import com.nashaofu.shell360.core.data.SessionKind
import com.nashaofu.shell360.core.data.SessionModel
import com.nashaofu.shell360.core.data.SessionStatus
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import com.nashaofu.shell360.feature.keys.KeyEditorDrawer
import com.nashaofu.shell360.feature.sftp.SftpScreen
import com.nashaofu.shell360.feature.terminal.TerminalScreen
import com.nashaofu.shell360.ui.theme.AppSizes
import com.nashaofu.shell360.ui.theme.AppSpacing
import com.nashaofu.shell360.ui.theme.AppTheme
import com.nashaofu.shell360.ui.theme.AppType
import kotlin.math.roundToInt
import kotlinx.coroutines.launch

/**
 * Uses a 52dp three-column session header
 * (menu 44 / session 1fr / actions 44) above every mounted session, an empty state, and
 * the session list sheet.
 */
@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun WorkspaceScreen(
    viewModel: WorkspaceViewModel = remember { WorkspaceViewModel() },
    onOpenNavigation: () -> Unit = {},
    onBrowseHosts: () -> Unit = {},
    initialSessionId: String? = null,
) {
    val state = viewModel.uiState
    val sessions = Shell360Store.sessions
    var addKeyOpen by remember { mutableStateOf(false) }
    val sftpDirs = remember { mutableStateMapOf<String, String>() }

    LaunchedEffect(sessions.size, state.activeSessionId) {
        viewModel.ensureActive()
    }
    LaunchedEffect(initialSessionId, sessions.size) {
        initialSessionId?.let { viewModel.onAction(WorkspaceAction.SessionSelected(it)) }
    }

    val active = sessions.firstOrNull { it.id == state.activeSessionId }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(AppTheme.colors.bgPage),
    ) {
        WorkspaceHeader(
            active = active,
            hostHostname = active?.let { Shell360Store.hostById(it.hostId)?.hostname },
            sftpDir = active?.let { sftpDirs[it.id] },
            onOpenNavigation = onOpenNavigation,
            onOpenSessions = { viewModel.onAction(WorkspaceAction.SessionPickerOpened) },
            onCloseSession = {
                active?.let { session ->
                    AndroidRuntime.scope.launch { AndroidRuntime.closeSession(session) }
                    viewModel.onAction(WorkspaceAction.SessionClosed(session.id))
                }
            },
        )

        Box(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(
                    WindowInsets.systemBars.only(
                        WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal,
                    ),
                ),
        ) {
            if (active == null) {
                WorkspaceEmptyState(onBrowseHosts = onBrowseHosts)
            } else {
                sessions.forEach { session ->
                    val isActive = session.id == active.id
                    // Keyed so per-session state (terminal view, scroll position, SFTP
                    // listing) is never reused when the slot changes.
                    key(session.id) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .alpha(if (isActive) 1f else 0f)
                                .zIndex(if (isActive) 1f else 0f),
                        ) {
                            when (session.kind) {
                                SessionKind.Terminal -> TerminalScreen(
                                    session = session,
                                    host = Shell360Store.hostById(session.hostId),
                                    onClose = {
                                        AndroidRuntime.releaseSession(session)
                                        viewModel.onAction(WorkspaceAction.SessionClosed(session.id))
                                    },
                                    onOpenAddKey = { addKeyOpen = true },
                                    onRetryConnection = { hostKeyDecision, authMethod, password, keyId ->
                                        val host = Shell360Store.hostById(session.hostId) ?: return@TerminalScreen
                                        Shell360Store.retrySession(session.id)
                                        AndroidRuntime.scope.launch {
                                            Shell360Store.sessionById(session.id)?.let {
                                                AndroidRuntime.connectSession(it, host.copy(
                                                    authenticationMethod = authMethod,
                                                    password = password,
                                                    keyId = keyId,
                                                ), hostKeyDecision)
                                            }
                                        }
                                    },
                                    onSendInput = { input ->
                                        AndroidRuntime.scope.launch { AndroidRuntime.sendTerminalInput(session, input) }
                                    },
                                )

                                SessionKind.Sftp -> SftpScreen(
                                    session = session,
                                    host = Shell360Store.hostById(session.hostId),
                                    onClose = {
                                        AndroidRuntime.releaseSession(session)
                                        viewModel.onAction(WorkspaceAction.SessionClosed(session.id))
                                    },
                                    onOpenAddKey = { addKeyOpen = true },
                                    onPathChange = { sftpDirs[session.id] = it },
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (state.isSessionPickerOpen) {
        SessionSheet(
            sessions = sessions,
            activeId = active?.id,
            onDismiss = { viewModel.onAction(WorkspaceAction.SessionPickerClosed) },
            onSelect = { viewModel.onAction(WorkspaceAction.SessionSelected(it)) },
            onCloseSession = {
                sessions.firstOrNull { session -> session.id == it }?.let { session -> AndroidRuntime.releaseSession(session) }
                viewModel.onAction(WorkspaceAction.SessionClosed(it))
            },
        )
    }

    KeyEditorDrawer(
        open = addKeyOpen,
        data = null,
        onCancel = { addKeyOpen = false },
        onSaved = { addKeyOpen = false },
    )
}

@Composable
private fun WorkspaceHeader(
    active: SessionModel?,
    hostHostname: String?,
    sftpDir: String?,
    onOpenNavigation: () -> Unit,
    onOpenSessions: () -> Unit,
    onCloseSession: () -> Unit,
) {
    val colors = AppTheme.colors
    var menuOpen by remember { mutableStateOf(false) }
    val empty = active == null

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.bgFrame)
            .windowInsetsPadding(
                WindowInsets.systemBars.only(
                    WindowInsetsSides.Top + WindowInsetsSides.Horizontal,
                ),
            ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(AppSizes.sessionHeader)
                .padding(horizontal = AppSpacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            WorkspaceHeaderButton(
                icon = Icons.Filled.Menu,
                contentDescription = "Open menu",
                enabled = true,
                onClick = onOpenNavigation,
            )

            Column(
                modifier = Modifier
                    .weight(1f)
                    .height(AppSizes.iconTile)
                    .clip(MaterialTheme.shapes.small)
                    .clickable(enabled = !empty) { onOpenSessions() }
                    .padding(horizontal = AppSpacing.sm),
                verticalArrangement = Arrangement.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = active?.name ?: "Workspace",
                        style = AppType.itemTitle,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (!empty) {
                        Icon(
                            imageVector = Icons.Filled.ArrowDropDown,
                            contentDescription = null,
                            tint = colors.textMuted,
                            modifier = Modifier
                                .padding(start = AppSpacing.xs)
                                .size(AppSizes.tableIcon),
                        )
                    }
                }
                if (active != null) {
                    Text(
                        text = sessionSubtitle(active, sftpDir = sftpDir, hostHostname = hostHostname),
                        style = AppType.caption,
                        color = colors.textSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            Box {
                WorkspaceHeaderButton(
                    icon = Icons.Filled.MoreVert,
                    contentDescription = "Session actions",
                    enabled = !empty,
                    onClick = { menuOpen = true },
                )
                DropdownMenu(
                    expanded = menuOpen,
                    onDismissRequest = { menuOpen = false },
                ) {
                    DropdownMenuItem(
                        text = { Text("Close session", style = AppType.body) },
                        onClick = {
                            menuOpen = false
                            onCloseSession()
                        },
                    )
                }
            }
        }

        HorizontalDivider(color = colors.borderSubtle)
    }
}

@Composable
private fun WorkspaceHeaderButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    IconButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.size(AppSizes.iconTile),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            modifier = Modifier.size(AppSizes.inlineIcon),
            tint = if (enabled) AppTheme.colors.textPrimary else AppTheme.colors.textMuted,
        )
    }
}

/** Mirrors mobile `.emptyState` / `.emptyIcon`: a 64dp accent-soft box, not a circle. */
@Composable
private fun WorkspaceEmptyState(onBrowseHosts: () -> Unit) {
    val colors = AppTheme.colors

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = AppSpacing.xxl),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Surface(
                modifier = Modifier.size(AppSizes.emptyIconBox),
                shape = MaterialTheme.shapes.large,
                color = colors.accentSoft,
                contentColor = colors.accent,
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Filled.Dns,
                        contentDescription = null,
                        modifier = Modifier.size(AppSizes.smallTile),
                    )
                }
            }

            Spacer(Modifier.height(AppSpacing.xl))
            Text(
                text = "No active sessions",
                style = AppType.emptyTitle,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(AppSpacing.sm))
            Text(
                text = "Open a host terminal to begin.",
                style = AppType.body,
                color = colors.textSecondary,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(AppSpacing.xxl))
            AppButton(onClick = onBrowseHosts) { Text("Browse Hosts") }
        }
    }
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun SessionSheet(
    sessions: List<SessionModel>,
    activeId: String?,
    onDismiss: () -> Unit,
    onSelect: (String) -> Unit,
    onCloseSession: (String) -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        shape = MaterialTheme.shapes.extraLarge,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(AppSizes.fieldHeight)
                .padding(horizontal = AppSpacing.lg),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Workspace · ${sessions.size}",
                style = AppType.cardTitle,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = AppSizes.sessionSheetMaxHeight)
                .verticalScroll(rememberScrollState())
                .padding(start = AppSpacing.lg, end = AppSpacing.lg, bottom = AppSpacing.lg),
        ) {
            SessionGroup(
                label = "Terminals",
                icon = Icons.Filled.Terminal,
                sessions = sessions.filter { it.kind == SessionKind.Terminal },
                activeId = activeId,
                onSelect = onSelect,
                onCloseSession = onCloseSession,
            )
            SessionGroup(
                label = "SFTP",
                icon = Icons.Filled.Folder,
                sessions = sessions.filter { it.kind == SessionKind.Sftp },
                activeId = activeId,
                onSelect = onSelect,
                onCloseSession = onCloseSession,
                modifier = Modifier.padding(top = AppSpacing.xl),
            )
        }
    }
}

@Composable
private fun SessionGroup(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    sessions: List<SessionModel>,
    activeId: String?,
    onSelect: (String) -> Unit,
    onCloseSession: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (sessions.isEmpty()) return
    val colors = AppTheme.colors

    Column(modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(bottom = AppSpacing.sm),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = colors.textMuted,
                modifier = Modifier.size(AppSizes.tableIcon),
            )
            Text(
                text = label.uppercase(),
                style = AppType.sectionLabel,
                color = colors.textMuted,
            )
        }

        sessions.forEach { session ->
            SessionSwipeRow(
                session = session,
                active = session.id == activeId,
                onSelect = { onSelect(session.id) },
                onClose = { onCloseSession(session.id) },
            )
            Spacer(Modifier.height(AppSpacing.sm))
        }
    }
}

@Composable
private fun SessionSwipeRow(
    session: SessionModel,
    active: Boolean,
    onSelect: () -> Unit,
    onClose: () -> Unit,
) {
    val colors = AppTheme.colors
    val revealWidth = with(LocalDensity.current) { AppSizes.swipeAction.toPx() }
    var offsetX by remember(session.id) { mutableFloatStateOf(0f) }
    val animatedOffset by animateFloatAsState(targetValue = offsetX, label = "sessionRowOffset")

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.small),
    ) {
        Row(
            modifier = Modifier
                .matchParentSize()
                .background(colors.statusError)
                .clickable { onClose() },
            horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(AppSizes.tableIcon),
            )
            Text(
                text = "Close",
                style = AppType.buttonLabel,
                color = Color.White,
            )
        }

        Row(
            modifier = Modifier
                .offset { IntOffset(animatedOffset.roundToInt(), 0) }
                .fillMaxWidth()
                .heightIn(min = AppSizes.listRow)
                .background(if (active) colors.accentSoft else colors.bgSurface)
                .pointerInput(session.id) {
                    detectHorizontalDragGestures(
                        onDragEnd = {
                            offsetX = if (offsetX < -revealWidth / 2f) -revealWidth else 0f
                        },
                    ) { _, dragAmount ->
                        offsetX = (offsetX + dragAmount).coerceIn(-revealWidth, 0f)
                    }
                }
                .clickable {
                    if (animatedOffset < -1f) {
                        offsetX = 0f
                    } else {
                        onSelect()
                    }
                }
                .padding(horizontal = AppSpacing.md),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            Surface(
                modifier = Modifier.size(AppSizes.statusDot),
                shape = RoundedCornerShape(percent = 50),
                color = when (session.status) {
                    SessionStatus.Success -> colors.statusSuccess
                    SessionStatus.Pending -> colors.statusWarning
                    SessionStatus.Failed -> colors.statusError
                },
            ) {}

            Column(Modifier.weight(1f)) {
                Text(
                    text = session.name,
                    style = AppType.itemTitle,
                    color = if (active) colors.accentText else colors.textPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = sheetSubtitle(session),
                    style = AppType.caption,
                    color = if (active) colors.accentText else colors.textSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            if (active) {
                Icon(
                    imageVector = Icons.Filled.Check,
                    contentDescription = "Active session",
                    tint = colors.accent,
                    modifier = Modifier.size(AppSizes.buttonIcon),
                )
            }
        }
    }
}

/** Mirrors the row subtitle in mobile `components/WorkspaceSessionSheet/index.tsx`. */
private fun sheetSubtitle(session: SessionModel): String = when (session.kind) {
    SessionKind.Sftp -> Shell360Store.hostById(session.hostId)?.hostname ?: session.name
    SessionKind.Terminal -> when (session.status) {
        SessionStatus.Success -> "Connected"
        SessionStatus.Pending -> "Connecting…"
        SessionStatus.Failed -> "Failed"
    }
}
