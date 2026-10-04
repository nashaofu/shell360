package com.nashaofu.shell360.core.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class ModelsTest {
    @Test
    fun keyTypeLabelFollowsThePublicKeyPrefix() {
        assertEquals("Ed25519", keyTypeLabel("ssh-ed25519 AAAAC3Nza"))
        assertEquals("Ed25519", keyTypeLabel("sk-ssh-ed25519@openssh.com AAAAC3Nza"))
        assertEquals("RSA", keyTypeLabel("ssh-rsa AAAAB3Nza"))
        assertEquals("RSA", keyTypeLabel("ssh-rsa-cert-v01@openssh.com AAAAB3Nza"))
        assertEquals("ECDSA", keyTypeLabel("ecdsa-sha2-nistp256 AAAAE2Vj"))
        assertEquals("ECDSA", keyTypeLabel("sk-ecdsa-sha2-nistp256@openssh.com AAAAE2Vj"))
        assertEquals("Key", keyTypeLabel(""))
    }

    @Test
    fun keyPreviewShortensLongMaterial() {
        assertEquals("short", keyPreview("ssh-ed25519 short"))

        val material = "AAAAC3NzaC1lZDI1NTE5AAAAIAAAAB3Nz"
        val preview = keyPreview("ssh-ed25519 $material")
        assertEquals("${material.take(12)}...${material.takeLast(7)}", preview)
        assertEquals(12 + 3 + 7, preview.length)
    }

    @Test
    fun envsRoundTripAndValidate() {
        val parsed = parseEnvs("KEY1=VALUE1, KEY2=VALUE2")
        assertEquals(2, parsed.size)
        assertEquals("KEY1", parsed[0].key)
        assertEquals("VALUE2", parsed[1].value)
        assertEquals("KEY1=VALUE1,KEY2=VALUE2", stringifyEnvs(parsed))

        assertEquals(emptyList<EnvVar>(), parseEnvs("INVALID"))
        assertNull(validateEnvs("KEY1=VALUE1"))
        assertNull(validateEnvs(""))
        assertNotNull(validateEnvs("INVALID"))
        assertNotNull(validateEnvs("KEY1="))
    }

    @Test
    fun hostTitleFallsBackToAddress() {
        val host = HostModel(hostname = "example.com", port = 2222, username = "root")
        assertEquals("example.com:2222", host.title)
        assertEquals("root@example.com:2222", host.description)

        val named = host.copy(name = "Prod")
        assertEquals("Prod", named.title)
    }

    @Test
    fun tunnelDescriptionResolvesPerType() {
        val local = TunnelModel(
            type = TunnelType.Local,
            localAddress = "127.0.0.1",
            localPort = 8080,
            remoteAddress = "db.internal",
            remotePort = 5432,
        )
        assertEquals(
            "Local 127.0.0.1:8080 => bastion => remote db.internal:5432",
            local.description("bastion"),
        )

        val dynamic = local.copy(type = TunnelType.Dynamic)
        assertEquals(
            "Local proxy 127.0.0.1:8080 => bastion  => any address",
            dynamic.description("bastion"),
        )
    }
}
