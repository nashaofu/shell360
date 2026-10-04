package com.nashaofu.shell360.feature.terminal

/**
 * Mirrors the error dispatch in `packages/shared/src/components/SSHLoading/index.tsx`:
 * `error.type` wins when present, otherwise the transport error `code` is mapped.
 */
enum class TerminalErrorKind { Default, UnknownServerKey, Authentication, KeyboardInteractive }

fun terminalErrorKind(type: String? = null, code: String? = null): TerminalErrorKind = when {
    type == TYPE_UNKNOWN_KEY || code == CODE_UNKNOWN_SERVER_KEY -> TerminalErrorKind.UnknownServerKey
    type == TYPE_AUTHENTICATION || code == CODE_AUTHENTICATION_FAILED -> TerminalErrorKind.Authentication
    code == CODE_KEYBOARD_INTERACTIVE -> TerminalErrorKind.KeyboardInteractive
    else -> TerminalErrorKind.Default
}

private const val TYPE_UNKNOWN_KEY = "UnknownKey"
private const val TYPE_AUTHENTICATION = "AuthenticationError"
private const val CODE_UNKNOWN_SERVER_KEY = "SSH_UNKNOWN_SERVER_KEY"
private const val CODE_AUTHENTICATION_FAILED = "SSH_AUTHENTICATION_FAILED"
private const val CODE_KEYBOARD_INTERACTIVE = "SSH_KEYBOARD_INTERACTIVE_REQUIRED"

/**
 * What the failed-state mask renders. [primaryMenuLabel] is only set for the two kinds
 * that use the reference's split button (main action + overflow menu item).
 */
data class TerminalErrorPresentation(
    val kind: TerminalErrorKind,
    val title: String,
    val message: String,
    val primaryLabel: String?,
    val primaryMenuLabel: String? = null,
)

fun terminalErrorPresentation(
    kind: TerminalErrorKind,
    message: String? = null,
    keyboardInteractiveName: String? = null,
    keyboardInstructions: String? = null,
): TerminalErrorPresentation {
    val text = message?.takeIf { it.isNotBlank() }

    return when (kind) {
        TerminalErrorKind.Default -> TerminalErrorPresentation(
            kind = kind,
            title = "Connection failed",
            message = text.orEmpty(),
            primaryLabel = "Retry",
        )

        TerminalErrorKind.UnknownServerKey -> TerminalErrorPresentation(
            kind = kind,
            title = "Are you sure you want to continue?",
            message = text.orEmpty(),
            primaryLabel = "Continue",
            primaryMenuLabel = "Add and continue",
        )

        TerminalErrorKind.Authentication -> TerminalErrorPresentation(
            kind = kind,
            title = text ?: "Authentication failed",
            message = text.orEmpty(),
            primaryLabel = "Continue",
            primaryMenuLabel = "Save and continue",
        )

        TerminalErrorKind.KeyboardInteractive -> TerminalErrorPresentation(
            kind = kind,
            title = keyboardInteractiveName?.takeIf { it.isNotBlank() }
                ?: "Keyboard interactive authentication",
            message = keyboardInstructions?.takeIf { it.isNotBlank() }
                ?: "Please answer the prompts.",
            primaryLabel = "Submit",
        )
    }
}
