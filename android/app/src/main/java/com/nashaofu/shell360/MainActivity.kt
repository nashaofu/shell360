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
import androidx.webkit.RestrictionAllowlist
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewBuilder
import androidx.webkit.WebViewFeature
import com.nashaofu.shell360.bridge.AndroidJsbInterface
import com.nashaofu.shell360.bridge.AndroidFileBridge
import com.nashaofu.shell360.bridge.JsbPortBridge
import com.nashaofu.shell360.bridge.PlatformHostServices
import com.nashaofu.shell360.ui.theme.Shell360Theme
import com.nashaofu.shell360.webview.Shell360WebViewClient

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null
    private var jsbPortBridge: JsbPortBridge? = null
    private val jsbInterface = AndroidJsbInterface()
    private lateinit var fileBridge: AndroidFileBridge

    @WebViewBuilder.Experimental
    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        val supportsNativeBridge = WebViewFeature.isFeatureSupported(
            WebViewFeature.WEBVIEW_BUILDER_EXPERIMENTAL_V1,
        ) && WebViewFeature.isFeatureSupported(
            WebViewFeature.CREATE_WEB_MESSAGE_CHANNEL,
        ) && WebViewFeature.isFeatureSupported(
            WebViewFeature.POST_WEB_MESSAGE,
        ) && WebViewFeature.isFeatureSupported(
            WebViewFeature.WEB_MESSAGE_PORT_SET_MESSAGE_CALLBACK,
        )
        if (!supportsNativeBridge) {
            val provider = WebViewCompat.getCurrentWebViewPackage(this)
            Log.e(TAG, "Native bridge is unavailable in WebView ${provider?.versionName}")
        }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    val bridge = jsbPortBridge
                    if (bridge == null) {
                        moveTaskToBack(true)
                        return
                    }
                    bridge.emitBackPress()
                }
            },
        )

        val rustBridge = (application as Shell360Application).rustBridge
        fileBridge = AndroidFileBridge(this)
        val hostServices = PlatformHostServices(
            context = this,
            fileBridge = fileBridge,
            closeWindow = {
                runOnUiThread {
                    finishAndRemoveTask()
                }
            },
            backToBackground = {
                runOnUiThread {
                    moveTaskToBack(true)
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
                            WebViewBuilder(WebViewBuilder.PRESET_LEGACY)
                                .restrictJavaScriptInterfaces()
                                .addAllowlist(
                                    RestrictionAllowlist.Builder(setOf(BuildConfig.WEBVIEW_ORIGIN))
                                        .addJavaScriptInterface(jsbInterface, "__JSB__")
                                        .build(),
                                )
                                .build(context)
                                .apply {
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
                                webView = this
                                jsbPortBridge = JsbPortBridge(this, rustBridge, hostServices)
                                jsbInterface.attach(checkNotNull(jsbPortBridge))
                                webViewClient = Shell360WebViewClient(context) {
                                    jsbPortBridge?.closeChannels()
                                }
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
        jsbInterface.detach()
        fileBridge.dispose()
        jsbPortBridge?.dispose()
        jsbPortBridge = null
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
    }
}
