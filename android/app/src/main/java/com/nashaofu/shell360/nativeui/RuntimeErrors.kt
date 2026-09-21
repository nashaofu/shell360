package com.nashaofu.shell360.nativeui

import org.json.JSONObject

fun JSONObject.toRuntimeError(): IllegalStateException {
    val error = optJSONObject("error")
    return IllegalStateException(error?.optString("message")?.ifBlank { null } ?: "Request failed")
}
