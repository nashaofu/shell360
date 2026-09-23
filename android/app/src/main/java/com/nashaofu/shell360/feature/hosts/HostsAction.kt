package com.nashaofu.shell360.feature.hosts

sealed interface HostsAction {
    data class QueryChanged(val value: String) : HostsAction
    data class TagSelected(val value: String?) : HostsAction
    data object AddClicked : HostsAction
    data class EditClicked(val host: HostItem) : HostsAction
    data class DuplicateClicked(val host: HostItem) : HostsAction
    data class DeleteClicked(val host: HostItem) : HostsAction
    data object DeleteDismissed : HostsAction
    data object DeleteConfirmed : HostsAction
    data object EditorDismissed : HostsAction
    data class HostSaved(val host: HostItem) : HostsAction
    data object ClearFiltersClicked : HostsAction
    data class ConnectionRequested(val protocol: String) : HostsAction
}
