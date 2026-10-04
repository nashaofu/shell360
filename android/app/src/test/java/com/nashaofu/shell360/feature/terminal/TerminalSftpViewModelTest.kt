package com.nashaofu.shell360.feature.terminal

import com.nashaofu.shell360.core.data.SessionKind
import com.nashaofu.shell360.core.data.SessionModel
import com.nashaofu.shell360.core.data.SessionStatus
import com.nashaofu.shell360.feature.sftp.CreateKind
import com.nashaofu.shell360.feature.sftp.SftpAction
import com.nashaofu.shell360.feature.sftp.SftpSortColumn
import com.nashaofu.shell360.feature.sftp.SftpViewModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TerminalSftpViewModelTest {
    @Test
    fun terminalStatusFollowsTheSessionLifecycle() {
        val viewModel = TerminalViewModel()

        viewModel.syncSession(SessionModel(status = SessionStatus.Pending))
        assertEquals(TerminalStatus.Connecting, viewModel.uiState.status)

        viewModel.syncSession(
            SessionModel(status = SessionStatus.Failed, error = "Permission denied"),
        )
        assertEquals(TerminalStatus.Error, viewModel.uiState.status)
        assertEquals("Permission denied", viewModel.uiState.errorMessage)

        viewModel.syncSession(SessionModel(kind = SessionKind.Terminal))
        assertEquals(TerminalStatus.Connecting, viewModel.uiState.status)
    }

    @Test
    fun virtualKeyboardInputIsAccumulatedAndRestorable() {
        val viewModel = TerminalViewModel()

        viewModel.onAction(TerminalAction.VirtualKey("l"))
        viewModel.onAction(TerminalAction.VirtualKey("s"))
        viewModel.onAction(TerminalAction.VirtualKey("\u001b[A"))

        assertEquals("ls\u001b[A", viewModel.uiState.inputLine)
        assertEquals("ls^[[A", escapeForDisplay(viewModel.uiState.inputLine))

        viewModel.onAction(TerminalAction.ClearInput)
        assertEquals("", viewModel.uiState.inputLine)
    }

    @Test
    fun keyboardToggleIsLocalUiState() {
        val viewModel = TerminalViewModel()

        viewModel.onAction(TerminalAction.ToggleKeyboard)
        assertTrue(viewModel.uiState.virtualKeyboardVisible)

        viewModel.onAction(TerminalAction.ToggleKeyboard)
        assertFalse(viewModel.uiState.virtualKeyboardVisible)
    }

    @Test
    fun creatingAFileAddsItToTheListing() {
        val viewModel = SftpViewModel()

        viewModel.onAction(SftpAction.CreateStarted(CreateKind.File))
        viewModel.onAction(SftpAction.CreateValueChanged("notes.txt"))
        viewModel.onAction(SftpAction.CreateConfirmed)

        assertEquals(1, viewModel.uiState.entries.size)
        assertEquals("notes.txt", viewModel.uiState.entries.first().name)
        assertEquals("/notes.txt", viewModel.uiState.entries.first().path)
        assertFalse(viewModel.uiState.entries.first().isDir)
    }

    @Test
    fun renamingAndDeletingUpdateTheListing() {
        val viewModel = SftpViewModel()

        viewModel.onAction(SftpAction.CreateStarted(CreateKind.Dir))
        viewModel.onAction(SftpAction.CreateValueChanged("src"))
        viewModel.onAction(SftpAction.CreateConfirmed)

        val created = viewModel.uiState.entries.first()
        viewModel.onAction(SftpAction.RenameStarted(created))
        viewModel.onAction(SftpAction.RenameValueChanged("lib"))
        viewModel.onAction(SftpAction.RenameConfirmed)

        assertEquals("lib", viewModel.uiState.entries.first().name)
        assertTrue(viewModel.uiState.entries.first().isDir)

        viewModel.onAction(SftpAction.DeleteRequested(viewModel.uiState.entries.first()))
        assertNotNull(viewModel.uiState.deleteTarget)
        viewModel.onAction(SftpAction.DeleteConfirmed)
        assertTrue(viewModel.uiState.entries.isEmpty())
    }

    @Test
    fun searchAndHiddenFilesAreIndependentUiActions() {
        val viewModel = SftpViewModel()

        viewModel.onAction(SftpAction.QueryChanged("notes"))
        viewModel.onAction(SftpAction.ToggleHiddenFiles)

        assertEquals("notes", viewModel.uiState.query)
        assertTrue(viewModel.uiState.showHiddenFiles)

        viewModel.onAction(SftpAction.QueryChanged(""))
        assertEquals("", viewModel.uiState.query)
        assertTrue(viewModel.uiState.showHiddenFiles)
    }

    @Test
    fun sortingTogglesDirectionForTheSameColumn() {
        val viewModel = SftpViewModel()

        viewModel.onAction(SftpAction.SortChanged(SftpSortColumn.Name))
        assertTrue(viewModel.uiState.isDesc)

        viewModel.onAction(SftpAction.SortChanged(SftpSortColumn.Name))
        assertFalse(viewModel.uiState.isDesc)

        viewModel.onAction(SftpAction.SortChanged(SftpSortColumn.Size))
        assertEquals(SftpSortColumn.Size, viewModel.uiState.orderBy)
        assertFalse(viewModel.uiState.isDesc)
    }

    @Test
    fun editingAFileStoresContentInTheListing() {
        val viewModel = SftpViewModel()

        viewModel.onAction(SftpAction.CreateStarted(CreateKind.File))
        viewModel.onAction(SftpAction.CreateValueChanged("hosts.conf"))
        viewModel.onAction(SftpAction.CreateConfirmed)

        viewModel.onAction(SftpAction.EntryOpened(viewModel.uiState.entries.first()))
        assertNotNull(viewModel.uiState.editingEntry)

        viewModel.onAction(SftpAction.EditorContentChanged("Host example.com"))
        viewModel.onAction(SftpAction.EditorSaved)

        assertEquals("Host example.com", viewModel.uiState.entries.first().content)
        assertTrue(viewModel.uiState.entries.first().size > 0)
    }
}
