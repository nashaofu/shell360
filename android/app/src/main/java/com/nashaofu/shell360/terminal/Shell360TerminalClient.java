package com.nashaofu.shell360.terminal;

import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import com.termux.terminal.ExternalTerminalOutput;
import com.termux.terminal.TerminalSession;
import com.termux.terminal.TerminalSessionClient;
import com.termux.view.TerminalViewClient;

/** Minimal mobile client connecting Termux rendering/input to Shell360 bytes. */
public final class Shell360TerminalClient implements TerminalViewClient, TerminalSessionClient, ExternalTerminalOutput {
    private final InputCallback input;
    private final Runnable closed;
    private final Runnable changed;

    public interface InputCallback { void onInput(byte[] data, int offset, int count); }

    public Shell360TerminalClient(InputCallback input, Runnable closed) {
        this(input, closed, () -> { });
    }

    public Shell360TerminalClient(InputCallback input, Runnable closed, Runnable changed) {
        this.input = input;
        this.closed = closed;
        this.changed = changed;
    }

    @Override public void onInput(byte[] data, int offset, int count) { input.onInput(data, offset, count); }
    /** External SSH output is owned by NativeTerminalSession; view teardown is not a remote disconnect. */
    @Override public void onClosed() { }

    @Override public float onScale(float scale) { return Math.max(0.5f, Math.min(2.0f, scale)); }
    @Override public void onSingleTapUp(MotionEvent e) { }
    @Override public boolean shouldBackButtonBeMappedToEscape() { return true; }
    @Override public boolean shouldEnforceCharBasedInput() { return false; }
    @Override public boolean shouldUseCtrlSpaceWorkaround() { return false; }
    @Override public boolean isTerminalViewSelected() { return true; }
    @Override public void copyModeChanged(boolean copyMode) { }
    @Override public boolean onKeyDown(int keyCode, KeyEvent e, TerminalSession session) { return false; }
    @Override public boolean onKeyUp(int keyCode, KeyEvent e) { return false; }
    @Override public boolean onLongPress(MotionEvent event) { return false; }
    @Override public boolean readControlKey() { return false; }
    @Override public boolean readAltKey() { return false; }
    @Override public boolean readShiftKey() { return false; }
    @Override public boolean readFnKey() { return false; }
    @Override public boolean onCodePoint(int codePoint, boolean ctrlDown, TerminalSession session) { return false; }
    @Override public void onEmulatorSet() { }
    @Override public void logError(String tag, String message) { }
    @Override public void logWarn(String tag, String message) { }
    @Override public void logInfo(String tag, String message) { }
    @Override public void logDebug(String tag, String message) { }
    @Override public void logVerbose(String tag, String message) { }
    @Override public void logStackTraceWithMessage(String tag, String message, Exception e) { }
    @Override public void logStackTrace(String tag, Exception e) { }
    @Override public void onTextChanged(TerminalSession session) { changed.run(); }
    @Override public void onTitleChanged(TerminalSession session) { }
    @Override public void onSessionFinished(TerminalSession session) { closed.run(); }
    @Override public void onCopyTextToClipboard(TerminalSession session, String text) { }
    @Override public void onPasteTextFromClipboard(TerminalSession session) { }
    @Override public void onBell(TerminalSession session) { }
    @Override public void onColorsChanged(TerminalSession session) { changed.run(); }
    @Override public void onTerminalCursorStateChange(boolean state) { }
    @Override public void setTerminalShellPid(TerminalSession session, int pid) { }
    @Override public Integer getTerminalCursorStyle() { return 0; }
}
