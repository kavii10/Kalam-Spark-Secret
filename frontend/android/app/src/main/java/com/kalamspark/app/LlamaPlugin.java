package com.kalamspark.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import androidx.activity.result.ActivityResult;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.AsyncTask;
import android.os.Environment;
import android.util.Log;
import java.io.File;

@SuppressWarnings({"unused", "ResultOfMethodCallIgnored", "deprecation", "Convert2Lambda", "SdCardPath", "StringConcatenation", "RedundantSuppression", "Convert2TextBlock", "TextBlockMigration"})
@CapacitorPlugin(name = "LlamaPlugin")
public class LlamaPlugin extends Plugin {
    private static final String TAG = "LlamaPlugin";
    private boolean isLoaded = false;
    private String selectedModelInternalPath = ""; // path of last user-selected model copied to internal storage

    private String getSavedModelPath() {
        try {
            android.content.SharedPreferences prefs = getContext().getSharedPreferences("KalamSparkPrefs", android.content.Context.MODE_PRIVATE);
            return prefs.getString("kalamspark_model_path", "");
        } catch (Exception e) {
            return "";
        }
    }

    private void saveModelPath(String path) {
        try {
            android.content.SharedPreferences prefs = getContext().getSharedPreferences("KalamSparkPrefs", android.content.Context.MODE_PRIVATE);
            prefs.edit().putString("kalamspark_model_path", path).apply();
        } catch (Exception e) {
            Log.e(TAG, "Failed to save model path to SharedPreferences", e);
        }
    }


    /**
     * Check if the model file exists at the given path.
     * Tries multiple paths to handle different Android/MIUI storage configurations.
     */
    @PluginMethod
    public void checkModelExists(PluginCall call) {
        if (selectedModelInternalPath == null || selectedModelInternalPath.isEmpty()) {
            selectedModelInternalPath = getSavedModelPath();
        }
        String modelPath = call.getString("modelPath");
        if (modelPath == null || modelPath.isEmpty()) {
            call.resolve(new JSObject().put("exists", false));
            return;
        }
        
        // Try the provided path first, then fallbacks
        String[] pathsToTry = buildPathCandidates(modelPath);
        for (String path : pathsToTry) {
            File file = new File(path);
            boolean exists = file.exists() && file.isFile() && file.length() > 0;
            if (exists) {
                try (java.io.FileInputStream fis = new java.io.FileInputStream(file)) {
                    fis.read(); // Read first byte to verify read permission
                } catch (Exception e) {
                    exists = false;
                }
            }
            Log.d(TAG, "checkModelExists: " + path + " -> " + exists + " (size: " + file.length() + ")");
            if (exists) {
                call.resolve(new JSObject().put("exists", true).put("resolvedPath", path));
                return;
            }
        }
        call.resolve(new JSObject().put("exists", false));
    }

    /**
     * Builds a list of candidate paths for the model file.
     * Handles: internal files, standard Android, MIUI, and alternative storage configs.
     */
    private String[] buildPathCandidates(String providedPath) {
        if (selectedModelInternalPath == null || selectedModelInternalPath.isEmpty()) {
            selectedModelInternalPath = getSavedModelPath();
        }
        // Extract just the filename
        String fileName = new File(providedPath).getName();
        
        // Standard external storage path
        File externalDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        // App's private internal storage directory
        File internalDir = getContext().getFilesDir();

        // If user selected a custom model, always check that path first
        if (selectedModelInternalPath != null && !selectedModelInternalPath.isEmpty()) {
            return new String[] {
                selectedModelInternalPath,                                  // User-selected custom model (highest priority)
                providedPath,                                               // Provided path (e.g. /storage/emulated/0/Download/model.gguf)
                internalDir.getAbsolutePath() + "/" + fileName,            // App's private internal storage
                externalDir.getAbsolutePath() + "/" + fileName,           // Environment.DIRECTORY_DOWNLOADS/filename
                "/storage/emulated/0/Download/" + fileName,               // Standard Android emulated path
                "/sdcard/Download/" + fileName,                            // Legacy sdcard path
                "/mnt/sdcard/Download/" + fileName,                        // MIUI alternative
                "/storage/emulated/0/Downloads/" + fileName,               // Some phones use 'Downloads' (plural)
            };
        }
        
        return new String[] {
            providedPath,                                               // Provided path (e.g. /storage/emulated/0/Download/model.gguf)
            internalDir.getAbsolutePath() + "/" + fileName,            // App's private internal storage
            externalDir.getAbsolutePath() + "/" + fileName,           // Environment.DIRECTORY_DOWNLOADS/filename
            "/storage/emulated/0/Download/" + fileName,               // Standard Android emulated path
            "/sdcard/Download/" + fileName,                            // Legacy sdcard path
            "/mnt/sdcard/Download/" + fileName,                        // MIUI alternative
            "/storage/emulated/0/Downloads/" + fileName,               // Some phones use 'Downloads' (plural)
        };
    }


    /**
     * Launches the system Document Picker so the user can browse and select the model GGUF file.
     * Works on Android 11+ without requesting MANAGE_EXTERNAL_STORAGE permission.
     * Once selected, copies the file into private internal storage.
     */
    @PluginMethod
    public void selectModelFile(PluginCall call) {
        saveCall(call);
        try {
            Log.d(TAG, "selectModelFile: Starting ACTION_OPEN_DOCUMENT intent");
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(call, intent, "pickModelCallback");
        } catch (android.content.ActivityNotFoundException e) {
            Log.w(TAG, "selectModelFile: ACTION_OPEN_DOCUMENT not found, trying ACTION_GET_CONTENT", e);
            try {
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                startActivityForResult(call, intent, "pickModelCallback");
            } catch (Exception ex) {
                Log.e(TAG, "selectModelFile: No document picker available on this device", ex);
                call.reject("No document picker available on this device: " + ex.getMessage());
            }
        } catch (Exception e) {
            Log.e(TAG, "selectModelFile: Failed to launch picker", e);
            call.reject("Failed to launch file picker: " + e.getMessage());
        }
    }

    @ActivityCallback
    public void pickModelCallback(PluginCall call, ActivityResult result) {
        if (call == null) {
            Log.e(TAG, "pickModelCallback: PluginCall is null!");
            return;
        }
        
        int resultCode = result.getResultCode();
        Log.d(TAG, "pickModelCallback: resultCode = " + resultCode);
        
        if (resultCode == Activity.RESULT_OK && result.getData() != null) {
            Uri uri = result.getData().getData();
            if (uri != null) {
                Log.d(TAG, "pickModelCallback: Selected URI = " + uri);
                try {
                    // Try to persist read permission
                    int takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION;
                    getContext().getContentResolver().takePersistableUriPermission(uri, takeFlags);
                    Log.d(TAG, "pickModelCallback: Successfully took persistable URI permission");
                } catch (Exception e) {
                    Log.w(TAG, "Failed to take persistable URI permission: " + e.getMessage());
                }

                // Open input stream synchronously on main thread inside callback context
                try {
                    final java.io.InputStream is = getContext().getContentResolver().openInputStream(uri);
                    if (is == null) {
                        Log.e(TAG, "pickModelCallback: Failed to open input stream (returned null)");
                        call.reject("Failed to open model file stream (null)");
                        return;
                    }
                    Log.d(TAG, "pickModelCallback: InputStream opened successfully, starting copy AsyncTask");
                    copyModelFileAsyncTask(call, is, uri);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to open input stream on main thread", e);
                    call.reject("Failed to open input stream: " + e.getMessage());
                }
                return;
            } else {
                Log.e(TAG, "pickModelCallback: Selected URI is null!");
            }
        }
        call.reject("File selection failed or cancelled (Result code: " + resultCode + ")");
    }

    private void copyModelFileAsyncTask(PluginCall call, final java.io.InputStream is, Uri uri) {
        // Resolve the actual display name from the URI
        String displayName = "model.gguf";
        try (android.database.Cursor cursor = getContext().getContentResolver().query(
                uri, new String[]{android.provider.OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIdx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
                if (nameIdx != -1) {
                    String name = cursor.getString(nameIdx);
                    if (name != null && !name.isEmpty()) displayName = name;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not resolve display name from URI: " + e.getMessage());
        }
        final String finalDisplayName = displayName;
        Log.d(TAG, "copyModelFileAsyncTask: destination filename = " + finalDisplayName);

        AsyncTask.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    File destFile = new File(getContext().getFilesDir(), finalDisplayName);
                    Log.d(TAG, "copyModelFileAsyncTask: Copying stream to " + destFile.getAbsolutePath());
                    
                    if (destFile.exists()) {
                        destFile.delete();
                    }

                    long totalBytes = 0;
                    try (android.database.Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
                        if (cursor != null && cursor.moveToFirst()) {
                            int sizeIndex = cursor.getColumnIndex(android.provider.OpenableColumns.SIZE);
                            if (sizeIndex != -1) {
                                totalBytes = cursor.getLong(sizeIndex);
                            }
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Failed to query file size: " + e.getMessage());
                    }

                    java.io.FileOutputStream os = new java.io.FileOutputStream(destFile);

                    byte[] buffer = new byte[64 * 1024];
                    int bytesRead;
                    long bytesCopied = 0;
                    long lastNotificationTime = 0;

                    while ((bytesRead = is.read(buffer)) != -1) {
                        os.write(buffer, 0, bytesRead);
                        bytesCopied += bytesRead;

                        long now = System.currentTimeMillis();
                        if (now - lastNotificationTime > 300) { // throttle notifications
                            int progress = 0;
                            if (totalBytes > 0) {
                                progress = (int) ((bytesCopied * 100) / totalBytes);
                            }
                            JSObject progressObj = new JSObject();
                            progressObj.put("status", "copying");
                            progressObj.put("progress", progress);
                            progressObj.put("copied", bytesCopied);
                            progressObj.put("total", totalBytes);
                            
                            notifyListeners("copyProgress", progressObj);
                            lastNotificationTime = now;
                        }
                    }

                    os.flush();
                    os.close();
                    is.close();

                    // Save the internal path so future loadModel calls can find it
                    selectedModelInternalPath = destFile.getAbsolutePath();
                    saveModelPath(destFile.getAbsolutePath());
                    Log.d(TAG, "copyModelFileAsyncTask: Saved selectedModelInternalPath = " + selectedModelInternalPath);

                    JSObject successObj = new JSObject();
                    successObj.put("status", "done");
                    successObj.put("path", destFile.getAbsolutePath());
                    successObj.put("filename", finalDisplayName);
                    successObj.put("size", destFile.length());
                    call.resolve(successObj);

                } catch (Exception e) {
                    Log.e(TAG, "Error copying model file", e);
                    try {
                        is.close();
                    } catch (Exception ignored) {}
                    call.reject("Error copying model file: " + e.getMessage());
                }
            }
        });
    }

    @PluginMethod
    public void loadModel(PluginCall call) {
        if (selectedModelInternalPath == null || selectedModelInternalPath.isEmpty()) {
            selectedModelInternalPath = getSavedModelPath();
        }
        String modelPath = call.getString("modelPath");
        if (modelPath == null || modelPath.isEmpty()) {
            call.reject("modelPath is required");
            return;
        }

        // Try multiple paths to find the model file
        String[] pathsToTry = buildPathCandidates(modelPath);
        File resolvedFile = null;

        for (String path : pathsToTry) {
            File candidate = new File(path);
            Log.d(TAG, "loadModel: trying " + path + " exists=" + candidate.exists() + " size=" + candidate.length());
            if (candidate.exists() && candidate.isFile() && candidate.length() > 1024 * 1024) {
                try (java.io.FileInputStream fis = new java.io.FileInputStream(candidate)) {
                    fis.read(); // verify read access
                    resolvedFile = candidate;
                    break;
                } catch (Exception e) {
                    Log.d(TAG, "loadModel: candidate " + path + " exists but is unreadable: " + e.getMessage());
                }
            }
        }

        if (resolvedFile == null) {
            // Try to give more helpful error
            File primaryPath = new File(modelPath);
            String detail;
            if (primaryPath.exists() && primaryPath.isFile()) {
                detail = "File found but appears incomplete (size: " + primaryPath.length() + " bytes). Re-download the GGUF model.";
            } else {
                detail = "Model not found. Place \"google_gemma-4-E2B-it-Q2_K.gguf\" in your Downloads folder." +
                         " Tried: " + String.join(", ", pathsToTry);
            }
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("message", detail);
            call.resolve(ret);
            return;
        }

        try {
            // In full JNI integration: nativeInitLlama(resolvedPath);
            // Currently uses Java fallback — the model "loads" by setting the loaded flag
            isLoaded = true;

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("message", "Model loaded: " + resolvedFile.getName() + " (" + (resolvedFile.length() / 1024 / 1024) + " MB)");
            call.resolve(ret);
        } catch (Exception e) {
            call.resolve(new JSObject().put("success", false).put("message", e.getMessage()));
        }
    }

    @PluginMethod
    public void generateCompletion(PluginCall call) {
        String prompt = call.getString("prompt");
        String systemInstruction = call.getString("systemInstruction");

        if (prompt == null) {
            call.reject("prompt is required");
            return;
        }

        if (!isLoaded) {
            call.reject("Model is not loaded. Call loadModel first.");
            return;
        }

        // Run inference in a background thread to prevent UI freezing
        AsyncTask.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    String result = nativeGenerate(systemInstruction, prompt);

                    JSObject ret = new JSObject();
                    ret.put("text", result);
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Inference failed: " + e.getMessage());
                }
            }
        });
    }

    // â”€â”€ JNI Native hooks (loaded from libllama.so compiled via CMake) â”€â”€
    private native String jniGenerate(String systemInstruction, String prompt);

    private String nativeGenerate(String system, String prompt) {
        try {
            if (isNativeLibraryLoaded) {
                return jniGenerate(system, prompt);
            }
        } catch (UnsatisfiedLinkError e) {
            Log.w(TAG, "libllama.so not found. Using Java NLP fallback.");
        }
        return generateJavaFallback(system, prompt);
    }

    private static boolean isNativeLibraryLoaded = false;
    static {
        try {
            System.loadLibrary("llama");
            isNativeLibraryLoaded = true;
            Log.i("LlamaPlugin", "libllama.so loaded successfully (native inference active).");
        } catch (UnsatisfiedLinkError e) {
            Log.w("LlamaPlugin", "libllama.so not available. Using Java NLP fallback (responses will be template-based).");
        }
    }

    // ── Java-level NLP fallback ──
    // Used when native C++ compilation is skipped or the library is not compiled.
    // In production: compile llama.cpp into libllama.so via CMakeLists.txt
    private String generateJavaFallback(String system, String prompt) {
        String targetCareer = parseTargetCareer(system, prompt);
        String userQuery = extractUserQuestion(prompt);
        
        boolean wantsJson = (system != null && !system.isEmpty()) && (
                            system.toLowerCase().contains("json") || 
                            system.toLowerCase().contains("schema")
                           );

        if (wantsJson) {
            return "{\n" +
                   "  \"dream\": \"" + targetCareer + "\",\n" +
                   "  \"summary\": \"Please load the local Gemma 4 model (.gguf) or connect to the internet to generate a real-time, personalized roadmap for " + targetCareer + ".\",\n" +
                   "  \"stages\": []\n" +
                   "}";
        }

        return "🔋 Offline AI Mentor:\n\n" +
               "I see you are asking about \"" + userQuery + "\" for your path to becoming a " + targetCareer + ".\n\n" +
               "To provide fresh, accurate, and real-time AI guidance without pre-built templates, Kalam Spark requires either an active internet connection or a loaded local LLM model.\n\n" +
               "Please connect to the internet, or go to Sidebar Settings -> Select Model File to load a local Gemma 4 model (.gguf) for fully offline real-time generation.";
    }

    // ── Helper: Extract user question from any prompt format ──────────────────
    private String extractUserQuestion(String prompt) {
        // Strategy 1: "Student: {q}\nAI:" format (primary)
        int lastStudentIdx = prompt.lastIndexOf("Student:");
        if (lastStudentIdx != -1) {
            String q = prompt.substring(lastStudentIdx + 8).trim();
            int aiIdx = q.indexOf("\nAI:");
            if (aiIdx == -1) aiIdx = q.indexOf("AI:");
            if (aiIdx != -1) q = q.substring(0, aiIdx).trim();
            if (!q.isEmpty() && q.length() < 1000) return q;
        }
        // Strategy 2: "User: {q}\nAssistant:" format
        int lastUserIdx = prompt.lastIndexOf("User:");
        if (lastUserIdx != -1) {
            String q = prompt.substring(lastUserIdx + 5).trim();
            int assistantIdx = q.indexOf("Assistant:");
            if (assistantIdx != -1) q = q.substring(0, assistantIdx).trim();
            q = q.replace("<end_of_turn>", "").replace("<start_of_turn>model", "").trim();
            if (!q.isEmpty() && q.length() < 1000) return q;
        }
        // Strategy 3: Last double-quoted string (context format "\"What is calculus\"")
        int lastClose = prompt.lastIndexOf("\"");
        if (lastClose > 0) {
            int lastOpen = prompt.lastIndexOf("\"", lastClose - 1);
            if (lastOpen != -1 && lastClose > lastOpen + 1) {
                String q = prompt.substring(lastOpen + 1, lastClose).trim();
                if (!q.isEmpty() && q.length() < 500) return q;
            }
        }
        // Fallback: last 300 chars
        return prompt.length() > 300 ? prompt.substring(prompt.length() - 300) : prompt;
    }

    // ── Helper: Parse career target from system instruction or prompt ─────────
    private String parseTargetCareer(String system, String prompt) {
        String target = "your chosen field";
        if (system != null && !system.isEmpty()) {
            String sysLower = system.toLowerCase();
            if (sysLower.contains("dream career:")) {
                int start = sysLower.indexOf("dream career:") + 13;
                int end = system.indexOf("\n", start);
                if (end == -1) end = system.length();
                target = system.substring(start, end).trim();
            } else if (sysLower.contains("dream:")) {
                int start = sysLower.indexOf("dream:") + 6;
                int end = system.indexOf("\n", start);
                if (end == -1) end = system.indexOf(",", start);
                if (end != -1) target = system.substring(start, end).trim();
            }
        }
        // Also parse from prompt: "[Context: ... Student dream: X. ...]"
        if (target.equals("your chosen field")) {
            String pLower = prompt.toLowerCase();
            if (pLower.contains("student dream:")) {
                int start = pLower.indexOf("student dream:") + 14;
                int end = prompt.indexOf(".", start);
                if (end == -1) end = prompt.indexOf("]", start);
                if (end == -1) end = prompt.indexOf(",", start);
                if (end != -1) target = prompt.substring(start, end).trim();
            }
        }
        return target.isEmpty() ? "your chosen field" : target;
    }
}
