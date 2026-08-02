package com.nashaofu.shell360

import android.content.Context
import android.net.Uri
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.nashaofu.shell360.bridge.BridgeRequest
import com.nashaofu.shell360.bridge.BridgeRouter
import com.nashaofu.shell360.bridge.RustBridge
import com.nashaofu.shell360.webview.Shell360WebViewClient
import org.json.JSONException
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeBridgeInstrumentedTest {
    @Test
    fun keygenRequestCallsRustLibrary() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val router = createRouter(context)
        val request = JSONObject()
            .put("id", "request-1")
            .put("clientId", "client-1")
            .put("method", "keygen.generate")
            .put(
                "params",
                JSONObject()
                    .put("algorithm", JSONObject().put("type", "Ed25519"))
                    .put("passphrase", "password"),
            )

        val response = JSONObject(router.handle(request.toString()))

        assertFalse(response.has("error"))
        assertTrue(
            response
                .getJSONObject("result")
                .getString("privateKey")
                .startsWith("-----BEGIN OPENSSH PRIVATE KEY-----"),
        )
    }

    @Test
    fun malformedRequestIsRejectedWithoutCrashing() {
        assertThrows(JSONException::class.java) {
            BridgeRequest.parse("not-json")
        }
        assertThrows(JSONException::class.java) {
            BridgeRequest.parse(JSONObject().put("id", "request-1").toString())
        }
    }

    @Test
    fun unsupportedMethodReturnsStructuredError() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val request = JSONObject()
            .put("id", "request-1")
            .put("clientId", "client-1")
            .put("method", "unknown.method")

        val response = JSONObject(createRouter(context).handle(request.toString()))

        assertEquals("request-1", response.getString("id"))
        assertEquals("BRIDGE_UNSUPPORTED", response.getJSONObject("error").getString("code"))
    }

    @Test
    fun invalidSystemBarParametersReturnRequestError() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val request = JSONObject()
            .put("id", "request-1")
            .put("clientId", "client-1")
            .put("method", "app.setSystemBarsAppearance")
            .put("params", JSONObject().put("dark", "yes"))

        val response = JSONObject(createRouter(context).handle(request.toString()))

        assertEquals("BRIDGE_INVALID_REQUEST", response.getJSONObject("error").getString("code"))
    }

    @Test
    fun clipboardRequestsReturnStructuredResponses() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val router = createRouter(context)
        val text = "shell360 clipboard"
        val writeRequest = JSONObject()
            .put("id", "write-request")
            .put("clientId", "client-1")
            .put("method", "clipboard.writeText")
            .put("params", JSONObject().put("text", text))
        val readRequest = JSONObject()
            .put("id", "read-request")
            .put("clientId", "client-1")
            .put("method", "clipboard.readText")

        assertFalse(JSONObject(router.handle(writeRequest.toString())).has("error"))
        assertTrue(JSONObject(router.handle(readRequest.toString())).get("result") is String)
    }

    @Test
    fun openUrlRejectsDisallowedScheme() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val request = JSONObject()
            .put("id", "request-1")
            .put("clientId", "client-1")
            .put("method", "core.openUrl")
            .put("params", JSONObject().put("url", "javascript:alert(1)"))

        val response = JSONObject(createRouter(context).handle(request.toString()))

        assertEquals("BRIDGE_INVALID_REQUEST", response.getJSONObject("error").getString("code"))
    }

    @Test
    fun appLocalDataTextFilesRoundTripAndRejectEscapes() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val router = createRouter(context)
        val path = "tests/bridge-file.txt"
        val writeRequest = JSONObject()
            .put("id", "write-file")
            .put("clientId", "client-1")
            .put("method", "fs.writeTextFile")
            .put(
                "params",
                JSONObject()
                    .put("path", path)
                    .put("contents", "shell360 file bridge")
                    .put("baseDir", "appLocalData"),
            )
        val readRequest = JSONObject()
            .put("id", "read-file")
            .put("clientId", "client-1")
            .put("method", "fs.readTextFile")
            .put(
                "params",
                JSONObject()
                    .put("path", path)
                    .put("baseDir", "appLocalData"),
            )
        val escapeRequest = JSONObject()
            .put("id", "escape-file")
            .put("clientId", "client-1")
            .put("method", "fs.readTextFile")
            .put(
                "params",
                JSONObject()
                    .put("path", "../outside.txt")
                    .put("baseDir", "appLocalData"),
            )

        try {
            assertFalse(JSONObject(router.handle(writeRequest.toString())).has("error"))
            assertEquals(
                "shell360 file bridge",
                JSONObject(router.handle(readRequest.toString())).getString("result"),
            )
            assertEquals(
                "BRIDGE_INVALID_REQUEST",
                JSONObject(router.handle(escapeRequest.toString()))
                    .getJSONObject("error")
                    .getString("code"),
            )
        } finally {
            context.filesDir.resolve("shell360/$path").delete()
        }
    }

    @Test
    fun sshFeatureRequestsReachTheNativeRuntime() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val router = createRouter(context)
        val sftpRequest = JSONObject()
            .put("id", "sftp-request")
            .put("clientId", "client-1")
            .put("method", "ssh.sftp.open")
            .put(
                "params",
                JSONObject()
                    .put("sshSessionId", "missing-session")
                    .put("sshSftpId", "sftp-1"),
            )
        val forwardingRequest = JSONObject()
            .put("id", "forwarding-request")
            .put("clientId", "client-1")
            .put("method", "ssh.portForwarding.openDynamic")
            .put(
                "params",
                JSONObject()
                    .put("sshSessionId", "missing-session")
                    .put("sshPortForwardingId", "forwarding-1")
                    .put("localAddress", "127.0.0.1")
                    .put("localPort", 1080),
            )

        assertEquals(
            "SSH_SESSION_NOT_FOUND",
            JSONObject(router.handle(sftpRequest.toString()))
                .getJSONObject("error")
                .getString("code"),
        )
        assertEquals(
            "SSH_SESSION_NOT_FOUND",
            JSONObject(router.handle(forwardingRequest.toString()))
                .getJSONObject("error")
                .getString("code"),
        )
    }

    @Test
    fun navigationPolicyAllowsOnlyTrustedOrExplicitExternalUris() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val client = Shell360WebViewClient(context)

        assertEquals(
            Shell360WebViewClient.NavigationTarget.INTERNAL,
            client.classifyNavigation(Uri.parse(BuildConfig.WEBVIEW_ORIGIN)),
        )
        assertEquals(
            Shell360WebViewClient.NavigationTarget.EXTERNAL,
            client.classifyNavigation(Uri.parse("https://example.com/path")),
        )
        assertEquals(
            Shell360WebViewClient.NavigationTarget.EXTERNAL,
            client.classifyNavigation(Uri.parse("mailto:user@example.com")),
        )
        assertEquals(
            Shell360WebViewClient.NavigationTarget.BLOCKED,
            client.classifyNavigation(Uri.parse("javascript:alert(1)")),
        )
        assertEquals(
            Shell360WebViewClient.NavigationTarget.BLOCKED,
            client.classifyNavigation(Uri.parse("https:///missing-host")),
        )
    }

    private fun createRouter(context: Context) = BridgeRouter(
        context = context,
        rustBridge = RustBridge(context),
        closeWindow = {},
        resetApplication = {},
        setSystemBarsAppearance = {},
    )
}
