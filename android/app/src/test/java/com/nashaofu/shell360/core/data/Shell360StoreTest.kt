package com.nashaofu.shell360.core.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class Shell360StoreTest {
    @Before
    fun setUp() {
        Shell360Store.reset()
    }

    @Test
    fun duplicateHostKeepsConfigurationUnderACopyName() {
        val host = Shell360Store.addHost(
            HostModel(name = "Prod", hostname = "example.com", username = "root"),
        )

        val copy = Shell360Store.duplicateHost(host)

        assertEquals(2, Shell360Store.hosts.size)
        assertEquals("Prod Copy", copy.name)
        assertEquals(host.hostname, copy.hostname)
        assertTrue(host.id != copy.id)
    }

    @Test
    fun savingAnExistingHostReplacesItInsteadOfAppending() {
        val host = Shell360Store.addHost(HostModel(name = "A", hostname = "a.example.com"))

        Shell360Store.saveHost(host.copy(name = "B"))

        assertEquals(1, Shell360Store.hosts.size)
        assertEquals("B", Shell360Store.hosts.first().name)
    }

    @Test
    fun deletingAHostAlsoRemovesItsTunnels() {
        val host = Shell360Store.addHost(HostModel(name = "A", hostname = "a.example.com"))
        Shell360Store.saveTunnel(TunnelModel(name = "local", hostId = host.id))
        Shell360Store.saveTunnel(TunnelModel(name = "other", hostId = "someone-else"))

        Shell360Store.deleteHost(host.id)

        assertEquals(1, Shell360Store.tunnels.size)
        assertEquals("other", Shell360Store.tunnels.first().name)
    }

    @Test
    fun openingSessionsNamesRepeatsWithACounter() {
        val host = Shell360Store.addHost(HostModel(name = "Prod", hostname = "example.com"))

        val first = Shell360Store.openSession(host, SessionKind.Terminal)
        val second = Shell360Store.openSession(host, SessionKind.Terminal)
        val sftp = Shell360Store.openSession(host, SessionKind.Sftp)

        assertEquals("Prod", first.name)
        assertEquals("Prod (1)", second.name)
        // Mirrors session.atom.ts: an SFTP session only counts other SFTP sessions, so the
        // first one starts at zero even though the host already has terminal sessions.
        assertEquals("Prod", sftp.name)
        assertEquals(3, Shell360Store.sessions.size)
    }

    @Test
    fun terminalSessionsCountEverySessionOfTheHost() {
        val host = Shell360Store.addHost(HostModel(name = "Prod", hostname = "example.com"))

        Shell360Store.openSession(host, SessionKind.Terminal)
        Shell360Store.openSession(host, SessionKind.Sftp)

        val secondTerminal = Shell360Store.openSession(host, SessionKind.Terminal)

        assertEquals("Prod (2)", secondTerminal.name)
    }

    @Test
    fun sftpSessionsCountOnlyOtherSftpSessions() {
        val host = Shell360Store.addHost(HostModel(name = "Prod", hostname = "example.com"))

        Shell360Store.openSession(host, SessionKind.Terminal)
        Shell360Store.openSession(host, SessionKind.Terminal)
        val firstSftp = Shell360Store.openSession(host, SessionKind.Sftp)
        val secondSftp = Shell360Store.openSession(host, SessionKind.Sftp)

        assertEquals("Prod", firstSftp.name)
        assertEquals("Prod (1)", secondSftp.name)
    }

    @Test
    fun sessionNamesFallBackToHostAndPort() {
        val host = Shell360Store.addHost(HostModel(name = "", hostname = "example.com", port = 2222))

        val session = Shell360Store.openSession(host, SessionKind.Terminal)

        assertEquals("example.com:2222", session.name)
    }

    @Test
    fun closingASessionKeepsTheOthers() {
        val host = Shell360Store.addHost(HostModel(name = "Prod", hostname = "example.com"))
        val first = Shell360Store.openSession(host, SessionKind.Terminal)
        Shell360Store.openSession(host, SessionKind.Sftp)

        Shell360Store.closeSession(first.id)

        assertEquals(1, Shell360Store.sessions.size)
        assertEquals(SessionKind.Sftp, Shell360Store.sessions.first().kind)
    }

    @Test
    fun tunnelRuntimeTracksRunningIds() {
        val tunnel = TunnelModel(name = "local", hostId = "host")
        Shell360Store.saveTunnel(tunnel)

        Shell360Store.startTunnel(tunnel.id)
        assertTrue(Shell360Store.isTunnelRunning(tunnel.id))

        Shell360Store.stopTunnel(tunnel.id)
        assertTrue(!Shell360Store.isTunnelRunning(tunnel.id))
    }

    @Test
    fun resetClearsEveryCollection() {
        val host = Shell360Store.addHost(HostModel(name = "Prod", hostname = "example.com"))
        Shell360Store.addKey(KeyModel(name = "id_ed25519"))
        Shell360Store.saveTunnel(TunnelModel(name = "local", hostId = host.id))
        Shell360Store.openSession(host, SessionKind.Terminal)
        Shell360Store.cryptoEnabled = true

        Shell360Store.reset()

        assertTrue(Shell360Store.hosts.isEmpty())
        assertTrue(Shell360Store.keys.isEmpty())
        assertTrue(Shell360Store.tunnels.isEmpty())
        assertTrue(Shell360Store.sessions.isEmpty())
        assertTrue(!Shell360Store.cryptoEnabled)
        assertTrue(Shell360Store.authed)
    }

    @Test
    fun exportThenImportRoundTripsTheConfiguration() {
        val host = Shell360Store.addHost(
            HostModel(
                name = "Prod",
                hostname = "example.com",
                port = 2222,
                username = "root",
                tags = listOf("prod", "eu"),
                authenticationMethod = AuthMethod.PublicKey,
                keyId = "key-1",
                envs = listOf(EnvVar("LANG", "en_US.UTF-8")),
                jumpHostIds = listOf("jump-1"),
            ),
        )
        Shell360Store.addKey(KeyModel(id = "key-1", name = "id_ed25519", publicKey = "ssh-ed25519 AAAA"))
        Shell360Store.saveTunnel(TunnelModel(name = "local", hostId = host.id, localPort = 8080))

        val json = AppDataJson.export()
        Shell360Store.reset()
        AppDataJson.import(json)

        assertEquals(1, Shell360Store.hosts.size)
        val restored = Shell360Store.hosts.first()
        assertEquals("Prod", restored.name)
        assertEquals(2222, restored.port)
        assertEquals(listOf("prod", "eu"), restored.tags)
        assertEquals(AuthMethod.PublicKey, restored.authenticationMethod)
        assertEquals("key-1", restored.keyId)
        assertEquals(listOf(EnvVar("LANG", "en_US.UTF-8")), restored.envs)
        assertEquals(listOf("jump-1"), restored.jumpHostIds)
        assertEquals(1, Shell360Store.keys.size)
        assertEquals(1, Shell360Store.tunnels.size)
        assertEquals(8080, Shell360Store.tunnels.first().localPort)
    }

    @Test
    fun importReplacesCollectionsInsteadOfMerging() {
        Shell360Store.addHost(HostModel(name = "Stale", hostname = "stale.example.com"))
        val json = AppDataJson.export()

        Shell360Store.reset()
        Shell360Store.addHost(HostModel(name = "Existing", hostname = "existing.example.com"))
        AppDataJson.import(json)

        assertEquals(1, Shell360Store.hosts.size)
        assertEquals("Stale", Shell360Store.hosts.first().name)
    }

    @Test
    fun hostLookupResolvesSavedHosts() {
        val host = Shell360Store.addHost(HostModel(name = "Prod", hostname = "example.com"))

        assertNotNull(Shell360Store.hostById(host.id))
        assertEquals("Prod", Shell360Store.hostTitle(host.id))
        assertNull(Shell360Store.hostById("missing"))
    }
}
