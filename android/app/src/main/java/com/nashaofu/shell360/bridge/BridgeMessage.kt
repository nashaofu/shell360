package com.nashaofu.shell360.bridge

import org.json.JSONObject

data class BridgeRequest(
    val id: String,
    val clientId: String,
    val method: String,
    val params: Any?,
) {
    companion object {
        fun parse(message: String): BridgeRequest {
            val json = JSONObject(message)
            return BridgeRequest(
                id = json.getString("id"),
                clientId = json.getString("clientId"),
                method = json.getString("method"),
                params = json.opt("params").takeUnless { it == JSONObject.NULL },
            )
        }
    }
}

object BridgeResponse {
    fun success(id: String, result: Any?): String {
        return JSONObject()
            .put("type", "result")
            .put("id", id)
            .put("result", result ?: JSONObject.NULL)
            .toString()
    }

    fun error(id: String?, code: String, message: String, details: Any? = null): String {
        val error = JSONObject()
            .put("code", code)
            .put("message", message)
        if (details != null) {
            error.put("details", details)
        }

        return JSONObject()
            .put("type", "result")
            .apply {
                if (id != null) {
                    put("id", id)
                }
            }
            .put("error", error)
            .toString()
    }
}
