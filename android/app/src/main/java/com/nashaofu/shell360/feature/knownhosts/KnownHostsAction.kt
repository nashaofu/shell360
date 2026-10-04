package com.nashaofu.shell360.feature.knownhosts

import com.nashaofu.shell360.core.data.KnownHostModel

sealed interface KnownHostsAction {
    data class QueryChanged(val value: String) : KnownHostsAction
    data class DeleteClicked(val item: KnownHostModel) : KnownHostsAction
    data object DeleteDismissed : KnownHostsAction
    data object DeleteConfirmed : KnownHostsAction
    data object ClearSearchClicked : KnownHostsAction
    data object FeedbackDismissed : KnownHostsAction
}
