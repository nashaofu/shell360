package com.nashaofu.shell360

import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)

    // 使用 WindowInsetsCompat 来兼容旧版本
    ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
      val params = view.layoutParams as? ViewGroup.MarginLayoutParams
        ?: ViewGroup.MarginLayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.MATCH_PARENT
        )

      // 输入法(IME)高度
      val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())

      // 底部安全区（键盘或导航栏）
      params.bottomMargin = maxOf(imeInsets.bottom, 0)

      view.layoutParams = params
      insets
    }
  }
}
