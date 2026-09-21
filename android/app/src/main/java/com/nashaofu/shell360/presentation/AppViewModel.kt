package com.nashaofu.shell360.presentation

import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.lifecycle.ViewModel
import com.nashaofu.shell360.nativeui.NativeHost
import com.nashaofu.shell360.nativeui.NativeKey
import com.nashaofu.shell360.nativeui.NativeSshSession
import com.nashaofu.shell360.terminal.NativeTerminalSession

/** Activity-independent UI state for the native Shell360 surface. */
class AppViewModel : ViewModel() {
    val route: MutableState<NativeRoute> = mutableStateOf(NativeRoute.Hosts)
    val selectedHost: MutableState<NativeHost?> = mutableStateOf(null)
    val connectedSsh: MutableState<NativeSshSession?> = mutableStateOf(null)
    val terminalSession: MutableState<NativeTerminalSession?> = mutableStateOf(null)
    val keys: MutableState<List<NativeKey>> = mutableStateOf(emptyList())
    val nativeLocked: MutableState<Boolean?> = mutableStateOf(null)
    val dataVersion: MutableState<Int> = mutableIntStateOf(0)
    val openDrawerRequest: MutableState<Int> = mutableIntStateOf(0)
    val sessionPickerRequest: MutableState<Int> = mutableIntStateOf(0)
    val drawerRoute: MutableState<Int> = mutableIntStateOf(0)

    fun openNavigation() {
        drawerRoute.value = when (route.value) {
            NativeRoute.Workspace -> 9
            NativeRoute.Keys -> 1
            NativeRoute.KnownHosts -> 2
            NativeRoute.PortForwarding -> 5
            NativeRoute.Settings -> 8
            else -> 0
        }
        openDrawerRequest.value++
    }

    fun navigate(next: NativeRoute) {
        route.value = next
    }

    fun clearCurrentSession() {
        connectedSsh.value = null
        terminalSession.value = null
    }
}
