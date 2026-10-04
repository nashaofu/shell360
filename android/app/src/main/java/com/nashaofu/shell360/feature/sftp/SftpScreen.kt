package com.nashaofu.shell360.feature.sftp

import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.automirrored.filled.InsertDriveFile
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.Icons
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import com.nashaofu.shell360.core.data.HostModel
import com.nashaofu.shell360.core.data.Shell360Store
import com.nashaofu.shell360.core.runtime.AndroidRuntime
import com.nashaofu.shell360.feature.terminal.SshLoadingMask
import com.nashaofu.shell360.feature.terminal.TerminalErrorKind
import com.nashaofu.shell360.feature.terminal.terminalErrorKind
import com.nashaofu.shell360.feature.terminal.terminalErrorPresentation
import com.nashaofu.shell360.core.data.SessionModel
import com.nashaofu.shell360.core.data.SessionStatus
import com.nashaofu.shell360.ui.components.AppSnackbarHost
import com.nashaofu.shell360.ui.components.AppDialog
import com.nashaofu.shell360.ui.components.AppTextButton
import com.nashaofu.shell360.ui.components.FeedbackEffect
import com.nashaofu.shell360.ui.components.FormTextField
import com.nashaofu.shell360.ui.components.AppFieldContainer
import com.nashaofu.shell360.ui.components.AppIconButton
import com.nashaofu.shell360.ui.components.rememberFeedbackHost
import com.nashaofu.shell360.ui.theme.AppSizes
import com.nashaofu.shell360.ui.theme.AppSpacing
import com.nashaofu.shell360.ui.theme.AppTheme
import kotlinx.coroutines.launch
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.nashaofu.shell360.feature.terminal.StatusOutlineButton
import com.nashaofu.shell360.feature.terminal.StatusPrimaryButton

/** Column geometry shared by the table header and the rows, so they cannot drift apart. */
private const val SFTP_MODAL_SCRIM_ALPHA = 0.40f
private const val SFTP_MODAL_WIDTH_FRACTION = 0.94f
private const val SFTP_MODAL_HEIGHT_FRACTION = 0.80f

@Composable
fun SftpScreen(
    session: SessionModel,
    host: HostModel?,
    onClose: () -> Unit,
    onOpenAddKey: () -> Unit,
    onPathChange: (String) -> Unit = {},
    viewModel: SftpViewModel = remember { SftpViewModel() },
) {
    LaunchedEffect(session.id, session.status, host?.id) {
        if (session.status == SessionStatus.Pending && host != null) AndroidRuntime.connectSession(session, host)
    }
    val state = viewModel.uiState
    val snackbarHostState = rememberFeedbackHost()
    var moreMenuOpen by remember { mutableStateOf(false) }
    var pendingDownload by remember { mutableStateOf<SftpEntry?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    fun refreshRemote(path: String = viewModel.uiState.path) {
        if (session.status != SessionStatus.Success || session.sshSftpId == null) return
        scope.launch {
            runCatching { AndroidRuntime.readSftpDirectory(session, path) }
                .onSuccess { viewModel.replaceDirectory(path, it) }
                .onFailure { viewModel.onAction(SftpAction.Feedback("Could not read folder: ${it.message}")) }
        }
    }

    val uploadLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val filename = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
            ?: uri.lastPathSegment.orEmpty()
        val remotePath = normalizeSftpPath("${viewModel.uiState.path}/$filename")
        scope.launch {
            runCatching { AndroidRuntime.sftpUpload(session, uri.toString(), remotePath) }
                .onSuccess { viewModel.onAction(SftpAction.Feedback("Upload complete")); refreshRemote() }
                .onFailure { viewModel.onAction(SftpAction.Feedback("Upload failed: ${it.message}")) }
        }
    }

    val downloadLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        val entry = pendingDownload
        pendingDownload = null
        if (uri == null || entry == null) return@rememberLauncherForActivityResult
        scope.launch {
            runCatching { AndroidRuntime.sftpDownload(session, uri.toString(), entry.path) }
                .onSuccess { viewModel.onAction(SftpAction.Feedback("Download complete")) }
                .onFailure { viewModel.onAction(SftpAction.Feedback("Download failed: ${it.message}")) }
        }
    }

    fun dispatch(action: SftpAction) {
        when (action) {
            SftpAction.UploadRequested -> uploadLauncher.launch(arrayOf("*/*"))
            is SftpAction.DownloadRequested -> {
                pendingDownload = action.entry
                downloadLauncher.launch(action.entry.name)
            }
            SftpAction.CreateConfirmed -> {
                val kind = viewModel.uiState.creatingKind
                val name = viewModel.uiState.creatingValue.trim()
                if (kind == null || name.isEmpty()) {
                    viewModel.onAction(action)
                    return
                }
                val path = normalizeSftpPath("${viewModel.uiState.path}/$name")
                scope.launch {
                    runCatching { AndroidRuntime.sftpCreate(session, path, kind == CreateKind.Dir) }
                        .onSuccess { viewModel.onAction(SftpAction.CreateCancelled); viewModel.onAction(SftpAction.Feedback("Created $name")); refreshRemote() }
                        .onFailure { viewModel.onAction(SftpAction.Feedback("Create failed: ${it.message}")) }
                }
            }
            SftpAction.RenameConfirmed -> {
                val oldPath = viewModel.uiState.renamingPath
                if (oldPath == null) {
                    viewModel.onAction(action)
                    return
                }
                val newName = viewModel.uiState.renamingValue.trim()
                val newPath = normalizeSftpPath("${sftpDirname(oldPath)}/$newName")
                scope.launch {
                    runCatching { AndroidRuntime.sftpRename(session, oldPath, newPath) }
                        .onSuccess { viewModel.onAction(SftpAction.RenameCancelled); viewModel.onAction(SftpAction.Feedback("Renamed to $newName")); refreshRemote() }
                        .onFailure { viewModel.onAction(SftpAction.Feedback("Rename failed: ${it.message}")) }
                }
            }
            SftpAction.DeleteConfirmed -> {
                val target = viewModel.uiState.deleteTarget
                if (target == null) {
                    viewModel.onAction(action)
                    return
                }
                scope.launch {
                    runCatching { AndroidRuntime.sftpDelete(session, target.path, target.isDir) }
                        .onSuccess { viewModel.onAction(SftpAction.DeleteDismissed); viewModel.onAction(SftpAction.Feedback("Removed ${target.name}")); refreshRemote() }
                        .onFailure { viewModel.onAction(SftpAction.Feedback("Delete failed: ${it.message}")) }
                }
            }
            is SftpAction.EntryOpened -> {
                viewModel.onAction(action)
                if (!action.entry.isDir) scope.launch {
                    runCatching { AndroidRuntime.sftpReadText(session, action.entry.path) }
                        .onSuccess { viewModel.onAction(SftpAction.EditorContentChanged(it)) }
                        .onFailure { viewModel.onAction(SftpAction.Feedback("Could not open file: ${it.message}")); viewModel.onAction(SftpAction.EditorClosed) }
                }
            }
            SftpAction.EditorSaved -> {
                val target = viewModel.uiState.editingEntry
                if (target == null) {
                    viewModel.onAction(action)
                    return
                }
                val content = viewModel.uiState.editingContent
                scope.launch {
                    runCatching { AndroidRuntime.sftpWriteText(session, target.path, content) }
                        .onSuccess { viewModel.onAction(SftpAction.EditorClosed); viewModel.onAction(SftpAction.Feedback("Saved ${target.name}")); refreshRemote() }
                        .onFailure { viewModel.onAction(SftpAction.Feedback("Save failed: ${it.message}")) }
                }
            }
            SftpAction.RefreshRequested -> refreshRemote()
            else -> viewModel.onAction(action)
        }
    }

    // Mirrors mobile `atoms/sftpDir.atom`: the workspace header shows the active directory.
    LaunchedEffect(state.path) {
        onPathChange(state.path)
    }

    LaunchedEffect(session.status, session.sshSftpId, state.path) {
        refreshRemote(state.path)
    }

    FeedbackEffect(state.feedbackMessage, snackbarHostState) {
        dispatch(SftpAction.FeedbackDismissed)
    }

    Box(Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(AppTheme.colors.bgPage)
                .imePadding(),
        ) {

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = AppSpacing.sm, vertical = AppSpacing.sm),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
            ) {
                if (state.isPathEditing) {
                    InlineFilenameInput(
                        value = state.pathDraft,
                        onValueChange = { dispatch(SftpAction.PathChanged(it)) },
                        onConfirm = { dispatch(SftpAction.PathConfirmed) },
                        onCancel = { dispatch(SftpAction.PathEditingCancelled) },
                        confirmLabel = "Confirm path",
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    SftpBreadcrumbs(
                        path = state.path,
                        onNavigate = { dispatch(SftpAction.NavigateTo(it)) },
                        onEdit = { dispatch(SftpAction.PathEditingStarted) },
                        modifier = Modifier.weight(1f),
                    )

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs),
                    ) {
                        if (state.isSearchVisible) {
                            ToolbarSearchField(
                                query = state.query,
                                onQueryChange = { dispatch(SftpAction.QueryChanged(it)) },
                            )
                        } else {
                            ToolbarIconButton(Icons.Filled.Search, "Filter") {
                                dispatch(SftpAction.SearchToggled)
                            }
                        }

                        ToolbarIconButton(Icons.Filled.FileUpload, "Upload file") {
                            dispatch(SftpAction.UploadRequested)
                        }

                        Box {
                            ToolbarIconButton(Icons.Filled.MoreVert, "More SFTP actions") {
                                moreMenuOpen = true
                            }
                            DropdownMenu(expanded = moreMenuOpen, onDismissRequest = { moreMenuOpen = false }) {
                                DropdownMenuItem(
                                    text = { Text("New File") },
                                    onClick = {
                                        moreMenuOpen = false
                                        dispatch(SftpAction.CreateStarted(CreateKind.File))
                                    },
                                )
                                DropdownMenuItem(
                                    text = { Text("New Folder") },
                                    onClick = {
                                        moreMenuOpen = false
                                        dispatch(SftpAction.CreateStarted(CreateKind.Dir))
                                    },
                                )
                                DropdownMenuItem(
                                    text = { Text("Refresh") },
                                    onClick = {
                                        moreMenuOpen = false
                                        dispatch(SftpAction.RefreshRequested)
                                    },
                                )
                                DropdownMenuItem(
                                    text = {
                                        Text(
                                            if (state.showHiddenFiles) {
                                                "Hide Hidden Files"
                                            } else {
                                                "Show Hidden Files"
                                            },
                                        )
                                    },
                                    onClick = {
                                        moreMenuOpen = false
                                        dispatch(SftpAction.ToggleHiddenFiles)
                                    },
                                )
                            }
                        }
                    }
                }
            }

            HorizontalDivider()

            SftpTableHeader(
                orderBy = state.orderBy,
                isDesc = state.isDesc,
                onSort = { dispatch(SftpAction.SortChanged(it)) },
            )
            HorizontalDivider()

            val visibleEntries = state.entries

            LazyColumn(Modifier.weight(1f)) {
                if (state.path != "/") {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = AppSizes.sftpRowHeight)
                                .clickable { dispatch(SftpAction.NavigateTo(sftpDirname(state.path))) }
                                .padding(horizontal = AppSpacing.sm),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs),
                        ) {
                            Icon(
                                Icons.Filled.Folder,
                                contentDescription = null,
                                tint = AppTheme.colors.accentText,
                                modifier = Modifier.size(AppSizes.tableIcon),
                            )
                            Text(
                                text = " ..",
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = AppTheme.colors.accentText,
                            )
                        }
                    }
                }

                if (state.creatingKind != null) {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = AppSpacing.lg, vertical = AppSpacing.sm),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                        ) {
                            FormTextField(
                                label = state.creatingKind.label,
                                value = state.creatingValue,
                                onValueChange = { dispatch(SftpAction.CreateValueChanged(it)) },
                                modifier = Modifier.weight(1f),
                                placeholder = state.creatingKind.label,
                            )
                            IconButton(onClick = { dispatch(SftpAction.CreateConfirmed) }) {
                                Icon(Icons.Filled.Check, contentDescription = "Confirm")
                            }
                            IconButton(onClick = { dispatch(SftpAction.CreateCancelled) }) {
                                Icon(Icons.Filled.Close, contentDescription = "Cancel")
                            }
                        }
                    }
                }

                if (visibleEntries.isEmpty() && state.creatingKind == null) {
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = AppSpacing.xxl),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Text(
                                text = if (state.query.isNotEmpty()) {
                                    "No files match the filter."
                                } else {
                                    "This folder is empty."
                                },
                                style = MaterialTheme.typography.bodyMedium,
                                color = AppTheme.colors.textSecondary,
                            )
                            if (state.query.isEmpty()) {
                                Text(
                                    text = "Use New File or New Folder to create an entry.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = AppTheme.colors.textSecondary,
                                    modifier = Modifier.padding(top = AppSpacing.sm),
                                )
                            }
                        }
                    }
                }

                items(visibleEntries, key = { it.path }) { entry ->
                    SftpEntryRow(
                        entry = entry,
                        isRenaming = state.renamingPath == entry.path,
                        renamingValue = state.renamingValue,
                        onRenamingValueChange = { dispatch(SftpAction.RenameValueChanged(it)) },
                        onRenameConfirm = { dispatch(SftpAction.RenameConfirmed) },
                        onRenameCancel = { dispatch(SftpAction.RenameCancelled) },
                        onOpen = { dispatch(SftpAction.EntryOpened(entry)) },
                        onDownload = { dispatch(SftpAction.DownloadRequested(entry)) },
                        onRename = { dispatch(SftpAction.RenameStarted(entry)) },
                        onDelete = { dispatch(SftpAction.DeleteRequested(entry)) },
                    )
                    HorizontalDivider(color = AppTheme.colors.accentBorder.copy(alpha = 0.4f))
                }
            }

            AppSnackbarHost(snackbarHostState)

            SftpTransferStatusBar(state.transfer)
        }

        // The reference hides the browser layer and covers it with SSHLoading.
        if (session.status != SessionStatus.Success) {
            val errorKind = terminalErrorKind(code = session.errorCode)
            SshLoadingMask(
                hostTitle = host?.title ?: session.name,
                command = "sftp ${host?.username.orEmpty()}@${host?.hostname.orEmpty()} -p ${host?.port ?: 0}",
                error = if (session.status == SessionStatus.Failed) {
                    terminalErrorPresentation(errorKind, session.error)
                } else null,
                onClose = onClose,
                onPrimaryAction = {
                    host?.let {
                        Shell360Store.retrySession(session.id)
                        AndroidRuntime.scope.launch {
                            Shell360Store.sessionById(session.id)?.let { current ->
                                AndroidRuntime.connectSession(current, it)
                            }
                        }
                    }
                },
                onPrimaryMenuAction = {
                    host?.let {
                        Shell360Store.retrySession(session.id)
                        AndroidRuntime.scope.launch {
                            Shell360Store.sessionById(session.id)?.let { current -> AndroidRuntime.connectSession(current, it, if (errorKind == TerminalErrorKind.UnknownServerKey) "AddAndContinue" else null) }
                        }
                    }
                },
                modifier = Modifier.matchParentSize(),
            )
        }
    }

    state.deleteTarget?.let { entry ->
        AppDialog(
            open = true,
            title = "Delete Confirmation",
            message = "Are you sure to delete ${entry.name}?",
            onDismiss = { dispatch(SftpAction.DeleteDismissed) },
            actions = {
                AppTextButton(onClick = { dispatch(SftpAction.DeleteConfirmed) }, danger = true) {
                    Text("Delete", color = AppTheme.colors.statusWarning)
                }
                AppTextButton(onClick = { dispatch(SftpAction.DeleteDismissed) }) {
                    Text("Cancel")
                }
            },
        )
    }

    state.editingEntry?.let { entry ->
        SftpFileEditorDialog(
            name = entry.name,
            content = state.editingContent,
            onContentChange = { dispatch(SftpAction.EditorContentChanged(it)) },
            onSave = { dispatch(SftpAction.EditorSaved) },
            onDismiss = { dispatch(SftpAction.EditorClosed) },
        )
    }
}

/** Mirrors `FileEditorModal`: 94vw × 80vh panel with 48dp header and footer. */
@Composable
private fun SftpFileEditorDialog(
    name: String,
    content: String,
    onContentChange: (String) -> Unit,
    onSave: () -> Unit,
    onDismiss: () -> Unit,
) {
    val colors = AppTheme.colors

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = SFTP_MODAL_SCRIM_ALPHA))
                .padding(AppSpacing.lg),
            contentAlignment = Alignment.Center,
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth(SFTP_MODAL_WIDTH_FRACTION)
                    .widthIn(max = AppSizes.contentMaxWidth)
                    .fillMaxHeight(SFTP_MODAL_HEIGHT_FRACTION),
                shape = MaterialTheme.shapes.medium,
                color = colors.bgSurface,
                border = BorderStroke(1.dp, colors.borderSubtle),
            ) {
                Column(Modifier.fillMaxSize()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(AppSizes.iconButton)
                            .padding(horizontal = AppSpacing.md),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.InsertDriveFile,
                            contentDescription = null,
                            tint = colors.textSecondary,
                            modifier = Modifier.size(AppSizes.buttonIcon),
                        )
                        Text(
                            text = "Edit File: $name",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = colors.textPrimary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                        ToolbarIconButton(Icons.Filled.Close, "Close editor", onDismiss)
                    }

                    HorizontalDivider(thickness = 1.dp, color = colors.borderSubtle)

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .padding(AppSpacing.md),
                    ) {
                        BasicTextField(
                            value = content,
                            onValueChange = onContentChange,
                            textStyle = MaterialTheme.typography.bodyMedium.copy(
                                fontFamily = FontFamily.Monospace,
                                color = colors.textPrimary,
                            ),
                            cursorBrush = SolidColor(colors.accent),
                            modifier = Modifier.fillMaxSize(),
                            decorationBox = { inner ->
                                if (content.isEmpty()) {
                                    Text(
                                        text = "File content...",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = colors.textMuted,
                                    )
                                }
                                inner()
                            },
                        )
                    }

                    HorizontalDivider(thickness = 1.dp, color = colors.borderSubtle)

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(AppSizes.iconButton)
                            .padding(horizontal = AppSpacing.md),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm, Alignment.End),
                    ) {
                        StatusOutlineButton("Cancel", onDismiss)
                        StatusPrimaryButton("Save", onSave)
                    }
                }
            }
        }
    }
}


@Composable
private fun SftpBreadcrumbs(
    path: String,
    onNavigate: (String) -> Unit,
    onEdit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val segments = path.split("/").filter { it.isNotEmpty() }

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "/",
            style = MaterialTheme.typography.bodyMedium,
            color = AppTheme.colors.accent,
            modifier = Modifier
                .clickable { onNavigate("/") }
                .padding(horizontal = AppSpacing.xs, vertical = 2.dp),
        )
        Row(
            modifier = Modifier.weight(1f, fill = false),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            segments.forEachIndexed { index, segment ->
                val target = "/" + segments.take(index + 1).joinToString("/")
                Text(
                    text = segment,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (index == segments.lastIndex) {
                        AppTheme.colors.textPrimary
                    } else {
                        AppTheme.colors.accent
                    },
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier
                        .clickable { onNavigate(target) }
                        .padding(horizontal = AppSpacing.xs, vertical = 2.dp),
                )
                if (index != segments.lastIndex) {
                    Text(
                        text = "/",
                        style = MaterialTheme.typography.bodyMedium,
                        color = AppTheme.colors.textSecondary,
                    )
                }
            }
        }
        IconButton(onClick = onEdit) {
            Icon(Icons.Filled.Edit, contentDescription = "Edit path", modifier = Modifier.size(AppSizes.buttonIcon))
        }
    }
}

@Composable
private fun SftpTableHeader(
    orderBy: SftpSortColumn,
    isDesc: Boolean,
    onSort: (SftpSortColumn) -> Unit,
) {
    val colors = AppTheme.colors

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.bgSurface)
            .padding(horizontal = AppSpacing.sm, vertical = AppSpacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SortableHeaderCell(
            label = "NAME",
            active = orderBy == SftpSortColumn.Name,
            isDesc = isDesc,
            onClick = { onSort(SftpSortColumn.Name) },
            modifier = Modifier.weight(1f),
        )
        SortableHeaderCell(
            label = "SIZE",
            active = orderBy == SftpSortColumn.Size,
            isDesc = isDesc,
            onClick = { onSort(SftpSortColumn.Size) },
            modifier = Modifier.width(AppSizes.sftpSizeColumnWidth),
        )
        Spacer(Modifier.width(AppSizes.sftpActionColumnWidth))
    }
}

/** Mirrors the reference header cell: 12sp/600 tracking, arrow always rendered. */
@Composable
private fun SortableHeaderCell(
    label: String,
    active: Boolean,
    isDesc: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = AppTheme.colors
    val contentColor = if (active) colors.accent else colors.textMuted

    Row(
        modifier = modifier.clickable { onClick() },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            color = contentColor,
            maxLines = 1,
        )
        Text(
            text = if (active && !isDesc) "▲" else "▼",
            style = MaterialTheme.typography.labelSmall,
            color = contentColor,
            modifier = Modifier.padding(start = AppSpacing.xs),
        )
    }
}

@Composable
private fun SftpEntryRow(
    entry: SftpEntry,
    isRenaming: Boolean,
    renamingValue: String,
    onRenamingValueChange: (String) -> Unit,
    onRenameConfirm: () -> Unit,
    onRenameCancel: () -> Unit,
    onOpen: () -> Unit,
    onDownload: () -> Unit,
    onRename: () -> Unit,
    onDelete: () -> Unit,
) {
    val colors = AppTheme.colors

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = AppSizes.sftpRowHeight)
            .padding(horizontal = AppSpacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            modifier = Modifier
                .weight(1f)
                .clickable(enabled = !isRenaming) { onOpen() },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
        ) {
            // The reference draws a bare icon (no tinted tile) in a 26dp slot.
            Box(
                modifier = Modifier.width(AppSizes.sftpIconSlotWidth),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = entry.icon(),
                    contentDescription = null,
                    modifier = Modifier.size(AppSizes.icon),
                    tint = colors.textMuted,
                )
            }

            Column(Modifier.weight(1f)) {
                if (isRenaming) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                    ) {
                        InlineFilenameInput(
                            value = renamingValue,
                            onValueChange = onRenamingValueChange,
                            onConfirm = onRenameConfirm,
                            onCancel = onRenameCancel,
                            confirmLabel = "Confirm rename",
                            modifier = Modifier.weight(1f),
                        )
                    }
                } else {
                    Text(
                        text = entry.name,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        color = colors.textPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                        Text(
                            text = formatSftpMtime(entry.mtime),
                            style = MaterialTheme.typography.labelSmall,
                            color = colors.textMuted,
                            maxLines = 1,
                        )
                        Text(
                            text = entry.permissions,
                            style = MaterialTheme.typography.labelSmall,
                            fontFamily = FontFamily.Monospace,
                            color = colors.textMuted,
                            maxLines = 1,
                        )
                    }
                }
            }
        }

        Text(
            text = entry.displaySize,
            style = MaterialTheme.typography.labelMedium,
            color = colors.textMuted,
            maxLines = 1,
            modifier = Modifier.width(AppSizes.sftpSizeColumnWidth),
        )

        Row(
            modifier = Modifier.width(AppSizes.sftpActionColumnWidth),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            RowActionButton(
                icon = Icons.Filled.FileDownload,
                contentDescription = "Download ${entry.name}",
                enabled = !entry.isDir,
                onClick = onDownload,
            )
            RowActionButton(
                icon = Icons.Filled.Edit,
                contentDescription = "Rename ${entry.name}",
                onClick = onRename,
            )
            RowActionButton(
                icon = Icons.Filled.DeleteOutline,
                contentDescription = "Delete ${entry.name}",
                onClick = onDelete,
            )
        }
    }
}

/** Mirrors `.optButton`: 28–32dp square, radius 6, muted icon, 35% opacity when disabled. */
@Composable
private fun RowActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
) {
    val colors = AppTheme.colors

    Box(
        modifier = Modifier
            .size(AppSizes.chipHeight)
            .clip(MaterialTheme.shapes.small)
            .clickable(enabled = enabled) { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            modifier = Modifier.size(AppSizes.buttonIcon),
            tint = if (enabled) colors.textMuted else colors.textMuted.copy(alpha = 0.35f),
        )
    }
}

/** Mirrors `SftpFilenameInput`: a compact inline field with confirm/cancel. */
@Composable
private fun InlineFilenameInput(
    value: String,
    onValueChange: (String) -> Unit,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
    confirmLabel: String,
    modifier: Modifier = Modifier,
) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
    ) {
        AppFieldContainer(modifier = Modifier.weight(1f), focused = focused) {
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace, color = AppTheme.colors.textPrimary),
                cursorBrush = SolidColor(AppTheme.colors.accent),
                interactionSource = interaction,
                modifier = Modifier.weight(1f),
            )
        }
        RowActionButton(
            icon = Icons.Filled.Check,
            contentDescription = confirmLabel,
            onClick = onConfirm,
            enabled = value.isNotBlank(),
        )
        RowActionButton(
            icon = Icons.Filled.Close,
            contentDescription = "Cancel",
            onClick = onCancel,
        )
    }
}

private fun SftpEntry.icon(): androidx.compose.ui.graphics.vector.ImageVector = when {
    isDir -> Icons.Filled.Folder
    isSymlink -> Icons.Filled.Link
    else -> Icons.AutoMirrored.Filled.InsertDriveFile
}

/** Toolbar icon button; one size for every toolbar action (the reference mixes 24/28/30/32). */
@Composable
private fun ToolbarIconButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
) {
    val colors = AppTheme.colors
    AppIconButton(
        icon = icon,
        contentDescription = contentDescription,
        onClick = onClick,
        tint = colors.textSecondary,
        size = AppSizes.iconButton,
    )
}

/** Mirrors `SftpFileSearch`: an inline 180dp filter field inside the toolbar. */
@Composable
private fun ToolbarSearchField(
    query: String,
    onQueryChange: (String) -> Unit,
) {
    val colors = AppTheme.colors
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()

    AppFieldContainer(
        modifier = Modifier.width(AppSizes.sftpSearchWidth),
        focused = focused,
    ) {
        BasicTextField(
            value = query,
            onValueChange = onQueryChange,
            singleLine = true,
            textStyle = MaterialTheme.typography.bodyMedium.copy(color = colors.textPrimary),
            cursorBrush = SolidColor(colors.accent),
            interactionSource = interaction,
            modifier = Modifier.weight(1f),
            decorationBox = { inner ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (query.isEmpty()) Text("Filter", style = MaterialTheme.typography.bodyMedium, color = colors.textMuted)
                    inner()
                }
            },
        )
    }
}

@Composable
private fun SftpTransferStatusBar(summary: SftpTransferSummary) {
    val colors = AppTheme.colors

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.bgSurface),
    ) {
        HorizontalDivider(thickness = 1.dp, color = colors.borderSubtle)
        Row(
            modifier = Modifier
                .height(AppSizes.sftpStatusBarHeight)
                .padding(horizontal = AppSpacing.sm),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            StatusCount(Icons.Filled.ArrowUpward, summary.uploading)
            StatusCount(Icons.Filled.ArrowDownward, summary.downloading)
            StatusCount(Icons.Filled.Check, summary.completed)
        }
    }
}

@Composable
private fun StatusCount(icon: androidx.compose.ui.graphics.vector.ImageVector, count: Int) {
    val colors = AppTheme.colors

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = colors.textSecondary,
            modifier = Modifier.size(AppSizes.tableIcon),
        )
        Text(
            text = count.toString(),
            style = MaterialTheme.typography.labelMedium,
            color = colors.textPrimary,
        )
    }
}
