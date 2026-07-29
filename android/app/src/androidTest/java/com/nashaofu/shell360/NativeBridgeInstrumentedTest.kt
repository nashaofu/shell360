package com.nashaofu.shell360

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.nashaofu.shell360.bridge.BridgeRouter
import com.nashaofu.shell360.bridge.RustBridge
import org.json.JSONObject
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeBridgeInstrumentedTest {
    @Test
    fun keygenRequestCallsRustLibrary() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val router = BridgeRouter(context, RustBridge(context)) {}
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
}
