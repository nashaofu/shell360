package com.nashaofu.shell360.feature.terminal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** Mirrors the error dispatch and copy of `SSHLoading` in the WebView reference. */
class TerminalErrorTest {
    @Test
    fun errorCodesMapToTheReferenceKinds() {
        assertEquals(
            TerminalErrorKind.UnknownServerKey,
            terminalErrorKind(code = "SSH_UNKNOWN_SERVER_KEY"),
        )
        assertEquals(
            TerminalErrorKind.Authentication,
            terminalErrorKind(code = "SSH_AUTHENTICATION_FAILED"),
        )
        assertEquals(
            TerminalErrorKind.KeyboardInteractive,
            terminalErrorKind(code = "SSH_KEYBOARD_INTERACTIVE_REQUIRED"),
        )
        assertEquals(TerminalErrorKind.Default, terminalErrorKind(code = "SOMETHING_ELSE"))
        assertEquals(TerminalErrorKind.Default, terminalErrorKind())
    }

    @Test
    fun explicitErrorTypeWinsOverTheCode() {
        assertEquals(TerminalErrorKind.UnknownServerKey, terminalErrorKind(type = "UnknownKey"))
        assertEquals(TerminalErrorKind.Authentication, terminalErrorKind(type = "AuthenticationError"))
        assertEquals(
            TerminalErrorKind.UnknownServerKey,
            terminalErrorKind(type = "UnknownKey", code = "SSH_AUTHENTICATION_FAILED"),
        )
    }

    @Test
    fun defaultKindOffersCloseAndRetry() {
        val presentation = terminalErrorPresentation(TerminalErrorKind.Default, message = "boom")

        assertEquals("Connection failed", presentation.title)
        assertEquals("boom", presentation.message)
        assertEquals("Retry", presentation.primaryLabel)
        assertNull(presentation.primaryMenuLabel)
    }

    @Test
    fun unknownServerKeyOffersTheSplitButton() {
        val presentation = terminalErrorPresentation(
            TerminalErrorKind.UnknownServerKey,
            message = "The host key is unknown",
        )

        assertEquals("Are you sure you want to continue?", presentation.title)
        assertEquals("The host key is unknown", presentation.message)
        assertEquals("Continue", presentation.primaryLabel)
        assertEquals("Add and continue", presentation.primaryMenuLabel)
    }

    @Test
    fun authenticationUsesTheErrorAsTitleWithAFallback() {
        val withMessage = terminalErrorPresentation(
            TerminalErrorKind.Authentication,
            message = "Authentication failed: bad password",
        )
        assertEquals("Authentication failed: bad password", withMessage.title)
        assertEquals("Save and continue", withMessage.primaryMenuLabel)

        val withoutMessage = terminalErrorPresentation(TerminalErrorKind.Authentication, message = "   ")
        assertEquals("Authentication failed", withoutMessage.title)
        assertEquals("", withoutMessage.message)
    }

    @Test
    fun keyboardInteractiveUsesThePromptCopy() {
        val prompts = terminalErrorPresentation(
            TerminalErrorKind.KeyboardInteractive,
            keyboardInteractiveName = "Two-factor authentication",
            keyboardInstructions = "Enter the code",
        )
        assertEquals("Two-factor authentication", prompts.title)
        assertEquals("Enter the code", prompts.message)
        assertEquals("Submit", prompts.primaryLabel)
        assertNull(prompts.primaryMenuLabel)

        val fallback = terminalErrorPresentation(TerminalErrorKind.KeyboardInteractive)
        assertEquals("Keyboard interactive authentication", fallback.title)
        assertEquals("Please answer the prompts.", fallback.message)
    }
}
