package com.nashaofu.shell360

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.nashaofu.shell360.bridge.BridgeRouter
import com.nashaofu.shell360.bridge.WebViewBridge
import com.nashaofu.shell360.ui.theme.Shell360Theme
import com.nashaofu.shell360.webview.Shell360WebViewClient

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null
    private var webViewBridge: WebViewBridge? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    val currentWebView = webView
                    if (currentWebView?.canGoBack() == true) {
                        currentWebView.goBack()
                    } else {
                        finish()
                    }
                }
            },
        )

        val rustBridge = (application as Shell360Application).rustBridge
        val router = BridgeRouter(
            context = this,
            rustBridge = rustBridge,
            closeWindow = {
                runOnUiThread {
                    finishAndRemoveTask()
                }
            },
            resetApplication = {
                runOnUiThread {
                    window.decorView.postDelayed(
                        {
                            rustBridge.shutdown()
                            finishAndRemoveTask()
                            android.os.Process.killProcess(android.os.Process.myPid())
                        },
                        250,
                    )
                }
            },
        )

        setContent {
            Shell360Theme {
                AndroidView(
                    modifier = Modifier
                        .fillMaxSize()
                        .safeDrawingPadding()
                        .imePadding(),
                    factory = { context ->
                        WebView(context).apply {
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            settings.allowFileAccess = false
                            settings.allowContentAccess = false
                            settings.javaScriptCanOpenWindowsAutomatically = false
                            settings.setSupportMultipleWindows(false)
                            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                            webViewClient = Shell360WebViewClient(context)

                            webView = this
                            webViewBridge = WebViewBridge(this, router, rustBridge)
                            loadUrl(BuildConfig.WEBVIEW_URL)
                        }
                    },
                )
            }
        }
    }

    override fun onDestroy() {
        webViewBridge?.dispose()
        webViewBridge = null
        webView?.destroy()
        webView = null
        super.onDestroy()
    }
}
