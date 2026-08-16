package com.nashaofu.shell360

import android.annotation.SuppressLint
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.nashaofu.shell360.bridge.BridgeRouter
import com.nashaofu.shell360.bridge.AndroidFileBridge
import com.nashaofu.shell360.bridge.WebViewBridge
import com.nashaofu.shell360.ui.theme.Shell360Theme
import com.nashaofu.shell360.webview.Shell360WebViewClient

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null
    private var webViewBridge: WebViewBridge? = null
    private lateinit var fileBridge: AndroidFileBridge

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        val supportsNativeBridge = WebViewFeature.isFeatureSupported(
            WebViewFeature.WEB_MESSAGE_LISTENER,
        )
        if (!supportsNativeBridge) {
            val provider = WebViewCompat.getCurrentWebViewPackage(this)
            Log.e(TAG, "Web message listener is unavailable in WebView ${provider?.versionName}")
        }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    val currentWebView = webView
                    if (currentWebView == null) {
                        finish()
                        return
                    }

                    currentWebView.evaluateJavascript(BACK_REQUEST_SCRIPT) { handled ->
                        if (handled != "true") {
                            finish()
                        }
                    }
                }
            },
        )

        val rustBridge = (application as Shell360Application).rustBridge
        fileBridge = AndroidFileBridge(this)
        val router = BridgeRouter(
            context = this,
            rustBridge = rustBridge,
            fileBridge = fileBridge,
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
            setSystemBarsAppearance = { dark ->
                runOnUiThread {
                    WindowCompat.getInsetsController(window, window.decorView).apply {
                        isAppearanceLightStatusBars = !dark
                        isAppearanceLightNavigationBars = !dark
                    }
                }
            },
        )

        setContent {
            Shell360Theme {
                if (supportsNativeBridge) {
                    AndroidView(
                        modifier = Modifier
                            .fillMaxSize(),
                        factory = { context ->
                            WebView(context).apply {
                                layoutParams = ViewGroup.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                )
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
                                if (savedInstanceState?.let(::restoreState) == null) {
                                    loadUrl(BuildConfig.WEBVIEW_URL)
                                }
                            }
                        },
                    )
                } else {
                    UnsupportedWebView()
                }
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView?.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        fileBridge.dispose()
        webViewBridge?.dispose()
        webViewBridge = null
        webView?.destroy()
        webView = null
        super.onDestroy()
    }

    @Composable
    private fun UnsupportedWebView() {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = stringResource(R.string.webview_update_required),
                color = MaterialTheme.colorScheme.onBackground,
                style = MaterialTheme.typography.bodyLarge,
            )
        }
    }

    private companion object {
        const val TAG = "Shell360Activity"
        const val BACK_REQUEST_SCRIPT =
            "window.dispatchEvent(new Event('shell360:back',{cancelable:true}))===false"
    }
}
