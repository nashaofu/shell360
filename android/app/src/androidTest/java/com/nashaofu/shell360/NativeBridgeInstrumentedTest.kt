package com.nashaofu.shell360

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.nashaofu.shell360.bridge.PlatformHostServices
import com.nashaofu.shell360.bridge.RustBridge
import com.nashaofu.shell360.ffi.NativeEngineOutput
import com.nashaofu.shell360.ffi.NativeEngineOutputKind
import com.nashaofu.shell360.ffi.NativeJsbEngine
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
            createEngine().dispatch(
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
        val response = JSONObject(createEngine().dispatch("not-json"))

        assertEquals("invoke.response", response.getString("type"))
        assertEquals("JSB_INVALID_MESSAGE", response.getJSONObject("error").getString("code"))
    }

    @Test
    fun unsupportedMethodReturnsStructuredError() {
        val response = JSONObject(createEngine().dispatch(request("unknown.method")))

        assertEquals("request-1", response.getString("id"))
        assertEquals("JSB_UNSUPPORTED", response.getJSONObject("error").getString("code"))
    }

    @Test
    fun appVersionUsesAndroidHostService() {
        val response = JSONObject(createEngine().dispatch(request("app.getVersion")))

        assertEquals(BuildConfig.VERSION_NAME, response.getString("data"))
    }

    private fun createEngine(): EngineHarness {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val rustBridge = RustBridge(context)
        val hostServices = PlatformHostServices(
            context = context,
            fileBridge = null,
            closeWindow = {},
            resetApplication = {},
            setSystemBarsAppearance = {},
        )
        return EngineHarness(rustBridge.createJsbEngine(hostServices), hostServices)
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

    private class EngineHarness(
        private val engine: NativeJsbEngine,
        hostServices: PlatformHostServices,
    ) {
        private val channelId = UUID.randomUUID().toString()
        private val completed = mutableListOf<NativeEngineOutput>()

        init {
            hostServices.attachCompletion { callId, resultJson ->
                completed += engine.completeHostCall(callId, resultJson)
            }
            engine.onChannelOpen(channelId)
        }

        fun dispatch(message: String): String {
            completed.clear()
            val outputs = engine.onControlFrame(channelId, message) + completed
            return outputs
                .first { it.kind == NativeEngineOutputKind.REPLY_TEXT }
                .text
                .orEmpty()
        }
    }
}
