package com.nashaofu.shell360.feature.terminal

import com.nashaofu.shell360.feature.sftp.SftpAction
import com.nashaofu.shell360.feature.sftp.SftpViewModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TerminalSftpViewModelTest {
    @Test
    fun retryKeepsTerminalRuntimeBoundaryVisible() {
        val viewModel = TerminalViewModel()

        viewModel.onAction(TerminalAction.Retry)

        assertEquals(TerminalStatus.Connecting, viewModel.uiState.status)
        assertEquals("Terminal runtime is not connected on Android yet.", viewModel.uiState.errorMessage)
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
    fun sftpSearchAndHiddenFilesAreIndependentUiActions() {
        val viewModel = SftpViewModel()

        viewModel.onAction(SftpAction.QueryChanged("notes"))
        viewModel.onAction(SftpAction.ToggleHiddenFiles)

        assertEquals("notes", viewModel.uiState.query)
        assertTrue(viewModel.uiState.showHiddenFiles)

        viewModel.onAction(SftpAction.QueryChanged(""))
        assertEquals("", viewModel.uiState.query)
        assertTrue(viewModel.uiState.showHiddenFiles)
    }
}
