package com.nashaofu.shell360.feature.hosts

import com.nashaofu.shell360.core.data.HostModel

sealed interface HostsAction {
    data class QueryChanged(val value: String) : HostsAction
    data class TagSelected(val value: String?) : HostsAction
    data object AddClicked : HostsAction
    data class EditClicked(val host: HostModel) : HostsAction
    data class DuplicateClicked(val host: HostModel) : HostsAction
    data class DeleteClicked(val host: HostModel) : HostsAction
    data object DeleteDismissed : HostsAction
    data object DeleteConfirmed : HostsAction
    data object EditorDismissed : HostsAction
    data object ClearFiltersClicked : HostsAction
    data object FeedbackDismissed : HostsAction
}
