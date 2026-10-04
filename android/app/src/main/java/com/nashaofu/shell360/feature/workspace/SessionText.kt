package com.nashaofu.shell360.feature.workspace

import com.nashaofu.shell360.core.data.SessionKind
import com.nashaofu.shell360.core.data.SessionModel

/**
 * Mirrors `simplifyPath` in mobile `components/Workspace/index.tsx`: paths longer than
 * two segments collapse to `…/last/segment`.
 */
internal fun simplifyPath(path: String): String {
    val segments = path.split('/').filter { it.isNotEmpty() }
    if (segments.size <= 2) return path
    return "…/" + segments.takeLast(2).joinToString("/")
}

/**
 * Mirrors the session subtitle in mobile `components/Workspace/index.tsx`:
 * `Terminal · Connecting|Failed|Connected`, or `SFTP · <simplified dir>` where the
 * directory falls back to the host hostname and then the session name.
 */
internal fun sessionSubtitle(
    session: SessionModel,
    sftpDir: String? = null,
    hostHostname: String? = null,
): String = when (session.kind) {
    SessionKind.Sftp -> {
        val dir = sftpDir?.takeIf { it.isNotEmpty() }
            ?: hostHostname?.takeIf { it.isNotEmpty() }
            ?: session.name
        "SFTP · ${simplifyPath(dir)}"
    }

    SessionKind.Terminal -> "Terminal · ${session.status.label}"
}
