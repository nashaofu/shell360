package com.nashaofu.shell360.feature.knownhosts

sealed interface KnownHostsAction {
    data class QueryChanged(val value: String) : KnownHostsAction
    data class DeleteClicked(val item: KnownHostItem) : KnownHostsAction
    data object FeedbackDismissed : KnownHostsAction
}
