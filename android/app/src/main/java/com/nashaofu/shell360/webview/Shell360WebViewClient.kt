package com.nashaofu.shell360.webview

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
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
        if (!request.isForMainFrame) {
            return true
        }

        return when (classifyNavigation(request.url)) {
            NavigationTarget.INTERNAL -> false
            NavigationTarget.BLOCKED -> true
            NavigationTarget.EXTERNAL -> {
                openExternalUri(view.context, request.url)
                true
            }
        }
    }

    private fun openExternalUri(context: Context, uri: Uri) {
        val intent = Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)
        if (intent.resolveActivity(context.packageManager) == null) {
            Log.w(TAG, "No application can open external URI scheme: ${uri.scheme}")
            return
        }

        try {
            context.startActivity(intent)
        } catch (error: ActivityNotFoundException) {
            Log.w(TAG, "External URI handler disappeared before launch", error)
        } catch (error: SecurityException) {
            Log.w(TAG, "External URI launch was rejected", error)
        }
    }

    internal fun classifyNavigation(uri: Uri): NavigationTarget {
        val origin = "${uri.scheme}://${uri.encodedAuthority}"
        if (origin == BuildConfig.WEBVIEW_ORIGIN) {
            return NavigationTarget.INTERNAL
        }

        val hasTarget = when (uri.scheme?.lowercase()) {
            "http", "https" -> !uri.host.isNullOrBlank()
            "mailto", "tel" -> !uri.schemeSpecificPart.isNullOrBlank()
            else -> false
        }
        return if (hasTarget) NavigationTarget.EXTERNAL else NavigationTarget.BLOCKED
    }

    internal enum class NavigationTarget {
        INTERNAL,
        EXTERNAL,
        BLOCKED,
    }

    private companion object {
        const val TAG = "Shell360WebView"
    }
}
