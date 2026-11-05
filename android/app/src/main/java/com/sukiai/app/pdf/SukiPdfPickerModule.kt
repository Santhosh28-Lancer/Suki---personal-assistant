package com.sukiai.app.pdf

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream

class SukiPdfPickerModule(
    private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context) {

    private var pendingPromise: Promise? = null

    private val requestCode = 7419
    private val maxBytes = 15L * 1024L * 1024L

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            intent: Intent?
        ) {
            if (requestCode != this@SukiPdfPickerModule.requestCode) return

            val promise = pendingPromise ?: return
            pendingPromise = null

            if (resultCode != Activity.RESULT_OK || intent?.data == null) {
                promise.resolve(null)
                return
            }

            var destination: File? = null

            try {
                val uri = intent.data!!
                val mime = context.contentResolver.getType(uri)

                if (mime != null && mime != "application/pdf") {
                    promise.reject("INVALID_TYPE", "Please select a PDF document.")
                    return
                }

                val name = queryName(uri) ?: "document.pdf"

                if (!name.lowercase().endsWith(".pdf")) {
                    promise.reject("INVALID_TYPE", "Please select a PDF document.")
                    return
                }

                destination = File(
                    context.cacheDir,
                    "suki-pdf-${System.currentTimeMillis()}.pdf"
                )

                var total = 0L

                val input = context.contentResolver.openInputStream(uri)
                    ?: throw IllegalStateException("Could not read the selected PDF.")

                input.use { source ->
                    FileOutputStream(destination).use { output ->
                        val buffer = ByteArray(8192)

                        while (true) {
                            val count = source.read(buffer)
                            if (count < 0) break

                            total += count

                            if (total > maxBytes) {
                                throw IllegalArgumentException(
                                    "PDF exceeds the 15 MB limit."
                                )
                            }

                            output.write(buffer, 0, count)
                        }
                    }
                }

                val result = Arguments.createMap().apply {
                    putString("uri", "file://${destination.absolutePath}")
                    putString("name", name)
                    putDouble("size", total.toDouble())
                    putString("type", "application/pdf")
                }

                promise.resolve(result)

            } catch (error: Exception) {
                destination?.delete()
                promise.reject(
                    "PDF_READ_FAILED",
                    error.message ?: "Could not read the PDF.",
                    error
                )
            }
        }
    }

    init {
        context.addActivityEventListener(activityEventListener)
    }

    override fun getName() = "SukiPdfPicker"

    @ReactMethod
    fun pickPdf(promise: Promise) {
        val activity = context.currentActivity

        if (activity == null) {
            promise.reject(
                "NO_ACTIVITY",
                "Suki could not open the document picker right now."
            )
            return
        }

        if (pendingPromise != null) {
            promise.reject(
                "PICKER_BUSY",
                "A document picker is already open."
            )
            return
        }

        pendingPromise = promise

        try {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "application/pdf"
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            activity.startActivityForResult(intent, requestCode)

        } catch (error: Exception) {
            pendingPromise = null
            promise.reject(
                "PICKER_FAILED",
                "Could not open the PDF picker.",
                error
            )
        }
    }

    @ReactMethod
    fun deleteTemporaryPdf(uriString: String, promise: Promise) {
        try {
            val uri = Uri.parse(uriString)
            val file = File(uri.path ?: "")
            val cacheRoot = context.cacheDir.canonicalFile
            val target = file.canonicalFile

            if (
                target.parentFile == cacheRoot &&
                target.name.startsWith("suki-pdf-") &&
                target.name.endsWith(".pdf")
            ) {
                if (target.exists()) target.delete()
            }

            promise.resolve(true)

        } catch (error: Exception) {
            promise.reject(
                "PDF_CLEANUP_FAILED",
                "Could not remove the temporary PDF copy.",
                error
            )
        }
    }

    private fun queryName(uri: Uri): String? {
        var cursor: Cursor? = null

        return try {
            cursor = context.contentResolver.query(
                uri,
                null,
                null,
                null,
                null
            )

            if (cursor != null && cursor.moveToFirst()) {
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0) cursor.getString(index) else null
            } else {
                null
            }

        } finally {
            cursor?.close()
        }
    }
}

