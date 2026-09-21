package com.nashaofu.shell360.nativeui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import com.nashaofu.shell360.R

@Composable
fun NativeTopBar(
    title: String,
    onBack: (() -> Unit)? = null,
    onOpenDrawer: (() -> Unit)? = null,
    actions: @Composable (() -> Unit)? = null,
) {
    val outlineColor = MaterialTheme.colorScheme.outline
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .statusBarsPadding()
            .height(64.dp)
            .padding(horizontal = 4.dp)
            .background(MaterialTheme.colorScheme.surface)
            .drawBehind {
                val stroke = 1.dp.toPx()
                drawLine(outlineColor.copy(alpha = 0.35f), Offset(16.dp.toPx(), size.height - stroke / 2), Offset(size.width - 16.dp.toPx(), size.height - stroke / 2), stroke)
            },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null || onOpenDrawer != null) {
            IconButton(onClick = onOpenDrawer ?: onBack ?: {}, modifier = Modifier.size(44.dp)) {
                androidx.compose.foundation.Image(
                    painter = painterResource(if (onOpenDrawer != null) R.drawable.ic_menu else R.drawable.ic_back),
                    contentDescription = if (onOpenDrawer != null) "Open navigation" else "Back",
                    modifier = Modifier.size(20.dp),
                    colorFilter = ColorFilter.tint(MaterialTheme.colorScheme.onSurface),
                )
            }
        }
        Text(
            title,
            style = MaterialTheme.typography.titleMedium.copy(fontSize = 18.sp, fontWeight = FontWeight.SemiBold),
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
        )
        actions?.invoke()
    }
}
