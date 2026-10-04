package com.nashaofu.shell360.feature.workspace

import com.nashaofu.shell360.core.data.SessionKind
import com.nashaofu.shell360.core.data.SessionModel
import com.nashaofu.shell360.core.data.SessionStatus
import org.junit.Assert.assertEquals
import org.junit.Test

/** Mirrors the behaviour of mobile `components/Workspace/index.tsx`. */
class SessionTextTest {
    @Test
    fun simplifyPathKeepsShortPathsUntouched() {
        assertEquals("/home", simplifyPath("/home"))
        assertEquals("/home/user", simplifyPath("/home/user"))
        assertEquals("", simplifyPath(""))
        assertEquals("relative", simplifyPath("relative"))
    }

    @Test
    fun simplifyPathCollapsesLongPathsToLastTwoSegments() {
        assertEquals("…/b/c", simplifyPath("/a/b/c"))
        assertEquals("…/y/z", simplifyPath("/x/y/z/"))
        assertEquals("…/deep/nested", simplifyPath("a/b/deep/nested"))
    }

    @Test
    fun terminalSubtitleFollowsStatus() {
        val session = SessionModel(name = "web", kind = SessionKind.Terminal)

        assertEquals(
            "Terminal · Connecting",
            sessionSubtitle(session.copy(status = SessionStatus.Pending)),
        )
        assertEquals(
            "Terminal · Connected",
            sessionSubtitle(session.copy(status = SessionStatus.Success)),
        )
        assertEquals(
            "Terminal · Failed",
            sessionSubtitle(session.copy(status = SessionStatus.Failed)),
        )
    }

    @Test
    fun sftpSubtitleFallsBackFromDirToHostnameToName() {
        val session = SessionModel(name = "web", kind = SessionKind.Sftp, hostId = "h1")

        assertEquals("SFTP · /srv/www", sessionSubtitle(session, sftpDir = "/srv/www"))
        assertEquals("SFTP · example.com", sessionSubtitle(session, hostHostname = "example.com"))
        assertEquals("SFTP · web", sessionSubtitle(session))
        assertEquals("SFTP · /srv/www", sessionSubtitle(session, sftpDir = "/srv/www", hostHostname = "example.com"))
        assertEquals("SFTP · …/srv/www", sessionSubtitle(session, sftpDir = "/mnt/data/srv/www"))
    }
}
