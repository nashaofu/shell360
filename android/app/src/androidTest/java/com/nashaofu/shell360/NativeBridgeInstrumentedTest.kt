package com.nashaofu.shell360

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.nashaofu.shell360.bridge.PlatformHostServices
import com.nashaofu.shell360.bridge.RustBridge
import com.nashaofu.shell360.ffi.JsbTransport
import com.nashaofu.shell360.ffi.NativeJsb
import java.util.Collections
import java.util.UUID
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeBridgeInstrumentedTest {
    @Test
    fun keygenRequestCallsRustLibrary() {
        val response = JSONObject(
            createHarness().dispatch(
                request(
                    "keygen.generate",
                    JSONObject()
                        .put("algorithm", JSONObject().put("type", "Ed25519"))
                        .put("passphrase", "password"),
                ),
            ),
        )

        assertFalse(response.has("error"))
        assertTrue(
            response
                .getJSONObject("data")
                .getString("privateKey")
                .startsWith("-----BEGIN OPENSSH PRIVATE KEY-----"),
        )
    }

    @Test
    fun malformedRequestReturnsStructuredError() {
        val response = JSONObject(createHarness().dispatch("not-json"))

        assertEquals("invoke.response", response.getString("type"))
        assertEquals("JSB_INVALID_MESSAGE", response.getJSONObject("error").getString("code"))
    }

    @Test
    fun unsupportedMethodReturnsStructuredError() {
        val response = JSONObject(createHarness().dispatch(request("unknown.method")))

        assertEquals("request-1", response.getString("id"))
        assertEquals("JSB_UNSUPPORTED", response.getJSONObject("error").getString("code"))
    }

    @Test
    fun appVersionResolvesFromRustRuntime() {
        val response = JSONObject(createHarness().dispatch(request("app.getVersion")))

        assertEquals("0.1.0", response.getString("data"))
    }

    @Test
    fun clipboardReadCompletesThroughHostServices() {
        val response = JSONObject(createHarness().dispatch(request("clipboard.readText")))

        assertFalse(response.has("error"))
        assertTrue(response.get("data") is String)
    }

    private fun createHarness(): JsbHarness {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val rustBridge = RustBridge(context)
        val hostServices = PlatformHostServices(
            context = context,
            fileBridge = null,
            closeWindow = {},
            backToBackground = {},
            resetApplication = {},
            setSystemBarsAppearance = {},
        )
        val transport = RecordingTransport()
        val jsb = rustBridge.createJsb(transport, hostServices)
        return JsbHarness(jsb, transport, hostServices)
    }

    private fun request(method: String, data: Any? = null): String {
        return JSONObject()
            .put("type", "invoke.request")
            .put("id", "request-1")
            .put("method", method)
            .apply {
                if (data != null) put("data", data)
            }
            .toString()
    }

    private class RecordingTransport : JsbTransport {
        val opened = Collections.synchronizedList(mutableListOf<Pair<String, String>>())
        val failed = Collections.synchronizedList(mutableListOf<Pair<String, String>>())
        val texts = Collections.synchronizedList(mutableListOf<Pair<String, String>>())
        val binaries = Collections.synchronizedList(mutableListOf<Pair<String, ByteArray>>())
        val closed = Collections.synchronizedList(mutableListOf<String>())

        override fun openChannel(channelId: String, controlMessage: String) {
            opened.add(channelId to controlMessage)
        }

        override fun failChannel(channelId: String, controlMessage: String) {
            failed.add(channelId to controlMessage)
        }

        override fun sendText(channelId: String, message: String) {
            texts.add(channelId to message)
        }

        override fun sendBinary(channelId: String, data: ByteArray) {
            binaries.add(channelId to data)
        }

        override fun closeChannel(channelId: String) {
            closed.add(channelId)
        }
    }

    private class JsbHarness(
        private val jsb: NativeJsb,
        private val transport: RecordingTransport,
        hostServices: PlatformHostServices,
    ) {
        private val channelId = UUID.randomUUID().toString()

        init {
            hostServices.attachCompletion { callId, resultJson ->
                jsb.completeHostCall(callId, resultJson)
            }
            jsb.openChannel(channelId)
            waitUntil { transport.opened.any { it.first == channelId } }
        }

        fun dispatch(message: String): String {
            synchronized(transport.texts) {
                transport.texts.clear()
            }
            jsb.receiveText(channelId, message)
            waitUntil {
                synchronized(transport.texts) {
                    transport.texts.any { it.first == channelId }
                }
            }
            return synchronized(transport.texts) {
                transport.texts.first { it.first == channelId }.second
            }
        }

        private fun waitUntil(timeoutMillis: Long = 10_000, condition: () -> Boolean) {
            val deadline = System.currentTimeMillis() + timeoutMillis
            while (System.currentTimeMillis() < deadline) {
                if (condition()) {
                    return
                }
                Thread.sleep(20)
            }
            error("timed out waiting for JSB frame")
        }
    }
}
