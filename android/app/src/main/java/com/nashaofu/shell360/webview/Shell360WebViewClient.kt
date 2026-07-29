package com.nashaofu.shell360.webview

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.webkit.WebViewAssetLoader
import com.nashaofu.shell360.BuildConfig

class Shell360WebViewClient(
    context: Context,
) : WebViewClient() {
    private val assetLoader = WebViewAssetLoader.Builder()
        .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(context))
        .build()

    override fun shouldInterceptRequest(
        view: WebView,
        request: WebResourceRequest,
    ): WebResourceResponse? {
        return assetLoader.shouldInterceptRequest(request.url)
            ?: super.shouldInterceptRequest(view, request)
    }

    override fun shouldOverrideUrlLoading(
        view: WebView,
        request: WebResourceRequest,
    ): Boolean {
        val uri = request.url
        if (request.isForMainFrame && isTrustedUri(uri)) {
            return false
        }

        if (request.isForMainFrame) {
            view.context.startActivity(Intent(Intent.ACTION_VIEW, uri))
        }
        return true
    }

    private fun isTrustedUri(uri: Uri): Boolean {
        val origin = "${uri.scheme}://${uri.encodedAuthority}"
        return origin == BuildConfig.WEBVIEW_ORIGIN
    }
}
