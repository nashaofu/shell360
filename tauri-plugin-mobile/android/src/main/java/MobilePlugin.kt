package com.nashaofu.mobile


import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResult
import java.io.OutputStreamWriter
import java.io.BufferedReader
import java.io.InputStreamReader
import app.tauri.Logger
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import app.tauri.plugin.Invoke
import app.tauri.annotation.ActivityCallback

// @InvokeArg
// class ExportTextFileRequest {
//     lateinit var filename: String
//     lateinit var data: String
// }

@TauriPlugin
class MobilePlugin(private val activity: Activity): Plugin(activity) {
  // @Command
  // fun exportTextFile(invoke: Invoke) {
  //     val args = invoke.parseArgs(ExportTextFileRequest::class.java)

  //     val intent: Intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
  //         .addCategory(Intent.CATEGORY_OPENABLE)
  //         .setType("*/*")
  //         .putExtra(Intent.EXTRA_TITLE, args.filename)

  //     startActivityForResult(invoke, intent, "onExportResult")
  // }

  // @ActivityCallback
  // fun onExportResult(invoke: Invoke, activityResult: ActivityResult) {
  //     val args = invoke.parseArgs(ExportTextFileRequest::class.java)

  //     try {
  //         val resultCode: Int = activityResult.resultCode
  //         val uri: Uri? = activityResult.data?.data
  //         if (resultCode == Activity.RESULT_OK && uri != null) {
  //             // 修改这里以包含你想要写入的数据
  //             activity.contentResolver.openOutputStream(uri)?.use { outputStream ->
  //                 OutputStreamWriter(outputStream).use { writer ->
  //                     writer.write(args.data)
  //                     writer.flush()
  //                     val callResult = JSObject()
  //                     callResult.put("cancel", false)
  //                     invoke.resolve(callResult)
  //                 }
  //             }
  //         } else {
  //             val callResult = JSObject()
  //             callResult.put("cancel", true)
  //             invoke.resolve(callResult)
  //         }
  //     } catch (e: Exception) {
  //         val message = e.message ?: "Failed writeToFile"
  //         Logger.error(message)
  //         invoke.reject(message)
  //     }
  // }

  // @Command
  // fun importTextFile(invoke: Invoke) {
  //     val intent: Intent = Intent(Intent.ACTION_GET_CONTENT)
  //         .addCategory(Intent.CATEGORY_OPENABLE)
  //         .setType("*/*")

  //     startActivityForResult(invoke, intent, "onImportResult")
  // }

  // @ActivityCallback
  // fun onImportResult(invoke: Invoke, activityResult: ActivityResult) {
  //     val stringBuilder: StringBuilder = StringBuilder()
  //     try {
  //         val resultCode: Int = activityResult.resultCode
  //         val uri: Uri? = activityResult.data?.data
  //         if (resultCode == Activity.RESULT_OK && uri != null) {
  //             // 修改这里以包含你想要写入的数据
  //             activity.contentResolver.openInputStream(uri)?.use { inputStream ->
  //                 val inputStreamReader = InputStreamReader(inputStream, Charsets.UTF_8)
  //                 val bufferedReader = BufferedReader(inputStreamReader)

  //                 var line: String?
  //                 while (bufferedReader.readLine().also { line = it } != null) {
  //                     stringBuilder.append(line)
  //                 }

  //                 inputStream.close()
  //                 val callResult = JSObject()
  //                 callResult.put("cancel", false)
  //                 callResult.put("data", stringBuilder.toString())
  //                 invoke.resolve(callResult)
  //             }
  //         } else {
  //             val callResult = JSObject()
  //             callResult.put("cancel", true)
  //             callResult.put("data", null)
  //             invoke.resolve(callResult)
  //         }
  //     } catch (e: Exception) {
  //         val message = e.message ?: "Failed writeToFile"
  //         Logger.error(message)
  //         invoke.reject(message)
  //     }
  // }
}
