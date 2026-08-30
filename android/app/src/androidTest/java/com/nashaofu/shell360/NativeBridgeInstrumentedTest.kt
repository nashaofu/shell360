package com.nashaofu.shell360

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.nashaofu.shell360.bridge.AndroidBridgeServices
import com.nashaofu.shell360.bridge.Jsb
import com.nashaofu.shell360.bridge.RustBridge
import com.nashaofu.shell360.bridge.registerAndroidRoutes
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
        val jsb = createJsb()
        val response = JSONObject(
            jsb.dispatch(
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
        val response = JSONObject(createJsb().dispatch("not-json"))

        assertEquals("invoke.response", response.getString("type"))
        assertEquals("JSB_INVALID_MESSAGE", response.getJSONObject("error").getString("code"))
    }

    @Test
    fun unsupportedMethodReturnsStructuredError() {
        val response = JSONObject(createJsb().dispatch(request("unknown.method")))

        assertEquals("request-1", response.getString("id"))
        assertEquals("JSB_UNSUPPORTED", response.getJSONObject("error").getString("code"))
    }

    @Test
    fun appVersionUsesRegisteredAndroidCallback() {
        val response = JSONObject(createJsb().dispatch(request("app.getVersion")))

        assertEquals(BuildConfig.VERSION_NAME, response.getString("data"))
    }

    private fun createJsb(): Jsb {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val rustBridge = RustBridge(context)
        val services = AndroidBridgeServices(
            context = context,
            rustBridge = rustBridge,
            closeWindow = {},
            resetApplication = {},
            setSystemBarsAppearance = {},
        )
        return Jsb().apply {
            registerAndroidRoutes(services, context)
            connect()
        }
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
}
