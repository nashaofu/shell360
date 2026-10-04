package com.nashaofu.shell360.feature.terminal

import com.nashaofu.shell360.core.data.AuthMethod
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Mirrors the state handled by `AuthenticationError/AuthenticationForm.tsx`. */
class TerminalAuthStateTest {
    @Test
    fun defaultsToPasswordAuthenticationWithEmptyFields() {
        val state = TerminalUiState()

        assertEquals(AuthMethod.Password, state.authMethod)
        assertEquals("", state.authPassword)
        assertEquals("", state.authKeyId)
        assertEquals("", state.keyboardAnswer)
    }

    @Test
    fun authenticationMethodCanBeSwitched() {
        val viewModel = TerminalViewModel()

        viewModel.onAction(TerminalAction.AuthMethodChanged(AuthMethod.PublicKey))
        assertEquals(AuthMethod.PublicKey, viewModel.uiState.authMethod)

        viewModel.onAction(TerminalAction.AuthMethodChanged(AuthMethod.KeyboardInteractive))
        assertEquals(AuthMethod.KeyboardInteractive, viewModel.uiState.authMethod)
    }

    @Test
    fun passwordIsClampedToTheReferenceLimit() {
        val viewModel = TerminalViewModel()

        viewModel.onAction(TerminalAction.AuthPasswordChanged("a".repeat(140)))

        assertEquals(MAX_AUTH_PASSWORD_LENGTH, viewModel.uiState.authPassword.length)
        assertEquals(100, MAX_AUTH_PASSWORD_LENGTH)
    }

    @Test
    fun passwordShorterThanTheLimitIsKeptVerbatim() {
        val viewModel = TerminalViewModel()

        viewModel.onAction(TerminalAction.AuthPasswordChanged("secret"))

        assertEquals("secret", viewModel.uiState.authPassword)
    }

    @Test
    fun keySelectionAndKeyboardAnswerAreStored() {
        val viewModel = TerminalViewModel()

        viewModel.onAction(TerminalAction.AuthKeyChanged("key-1"))
        viewModel.onAction(TerminalAction.KeyboardAnswerChanged("123456"))

        assertEquals("key-1", viewModel.uiState.authKeyId)
        assertEquals("123456", viewModel.uiState.keyboardAnswer)
    }

    @Test
    fun addKeySentinelCannotCollideWithAKeyId() {
        assertNotEquals(ADD_KEY_OPTION_VALUE, "key-1")
        assertTrue(ADD_KEY_OPTION_VALUE.first() == '\u0000')
    }
}
