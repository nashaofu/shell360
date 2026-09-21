package com.nashaofu.shell360.presentation

sealed interface NativeRoute {
    data object Workspace : NativeRoute
    data object Hosts : NativeRoute
    data object PortForwarding : NativeRoute
    data object Keys : NativeRoute
    data object KnownHosts : NativeRoute
    data object Settings : NativeRoute
    data class EditHost(val hostId: String?) : NativeRoute
    data class ConnectTerminal(val hostId: String) : NativeRoute
    data class ConnectSftp(val hostId: String) : NativeRoute
    data class Terminal(val sessionId: String) : NativeRoute
    data class Sftp(val sessionId: String) : NativeRoute
}

sealed interface UiState<out T> {
    data object Initial : UiState<Nothing>
    data object Loading : UiState<Nothing>
    data class Ready<T>(val value: T) : UiState<T>
    data class Empty<T>(val value: T) : UiState<T>
    data class Refreshing<T>(val value: T) : UiState<T>
    data class Error<T>(val value: T?, val message: String, val recoverable: Boolean) : UiState<T>
    data class Offline<T>(val value: T?, val message: String) : UiState<T>
}
