package com.nashaofu.shell360.feature.unlock

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.nashaofu.shell360.ui.components.AppCenteredContent
import com.nashaofu.shell360.ui.components.AppSnackbarHost
import com.nashaofu.shell360.ui.components.AppButton
import com.nashaofu.shell360.ui.components.AppDialog
import com.nashaofu.shell360.ui.components.AppTextButton
import com.nashaofu.shell360.ui.components.FeedbackEffect
import com.nashaofu.shell360.ui.components.FormPasswordField
import com.nashaofu.shell360.ui.components.rememberFeedbackHost
import com.nashaofu.shell360.ui.theme.AppSizes
import com.nashaofu.shell360.ui.theme.AppSpacing
import com.nashaofu.shell360.ui.theme.AppType

@Composable
fun UnlockScreen(
    viewModel: UnlockViewModel = remember { UnlockViewModel() },
) {
    val state = viewModel.uiState
    val snackbarHostState = rememberFeedbackHost()

    FeedbackEffect(state.feedbackMessage, snackbarHostState) {
        viewModel.onAction(UnlockAction.FeedbackDismissed)
    }

    Scaffold(
        snackbarHost = { AppSnackbarHost(snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        AppCenteredContent(
            modifier = Modifier
                .imePadding()
                .padding(padding),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
                Surface(
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primaryContainer,
                    modifier = Modifier.size(AppSizes.emptyCircle),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Filled.Lock,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(AppSizes.emptyIcon),
                        )
                    }
                }

                Text(
                    text = "Application Locked",
                    style = AppType.headerTitle,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = AppSpacing.xl),
                )
                Text(
                    text = "Enter your password to unlock",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = AppSpacing.sm),
                )

                Spacer(Modifier.height(AppSpacing.xl))

                FormPasswordField(
                    label = "Password",
                    value = state.password,
                    onValueChange = { viewModel.onAction(UnlockAction.PasswordChanged(it)) },
                    placeholder = "Please enter the password",
                    enabled = !state.isLoading,
                )

                Spacer(Modifier.height(AppSpacing.lg))

                AppButton(
                    onClick = { viewModel.onAction(UnlockAction.UnlockClicked) },
                    enabled = !state.isLoading && state.password.isNotEmpty(),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (state.isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(AppSizes.buttonIcon),
                            strokeWidth = 2.dp,
                        )
                        Spacer(Modifier.width(AppSpacing.sm))
                    }
                    Text(if (state.isLoading) "Unlocking..." else "Unlock")
                }

                Spacer(Modifier.height(AppSpacing.md))

                AppTextButton(
                    onClick = { viewModel.onAction(UnlockAction.ResetClicked) },
                    enabled = !state.isLoading,
                ) {
                    Text("Reset all data", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
        }
    }

    if (state.isResetConfirmOpen) {
        AppDialog(
            open = true,
            title = "Warning",
            message = "All application data will be reset soon, whether to continue",
            onDismiss = { viewModel.onAction(UnlockAction.ResetDismissed) },
            actions = {
                AppTextButton(onClick = { viewModel.onAction(UnlockAction.ResetConfirmed) }, danger = true) {
                    Text("Continue", color = MaterialTheme.colorScheme.error)
                }
                AppTextButton(onClick = { viewModel.onAction(UnlockAction.ResetDismissed) }) {
                    Text("Cancel")
                }
            },
        )
    }
}
