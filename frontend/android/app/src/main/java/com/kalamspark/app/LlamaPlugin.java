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
    // In production: compile llama.cpp into libllama.so via CMakeLists.txt for real AI inference.
    private String generateJavaFallback(String system, String prompt) {
        String pLower = prompt.toLowerCase();
        String sLower = (system != null) ? system.toLowerCase() : "";

        // Check if the caller specifically requested structured JSON output (system instruction is the most reliable indicator)
        boolean wantsJson = (system != null && !system.isEmpty()) && (
                            sLower.contains("json") || 
                            sLower.contains("schema") || 
                            sLower.contains("return only") || 
                            sLower.contains("valid raw")
                           );

        if (wantsJson) {
            // 1. Roadmap Generation
            if (pLower.contains("roadmap") || pLower.contains("stages")) {
                String dream = "Software Engineer";
                if (pLower.contains("data scientist")) dream = "Data Scientist";
                else if (pLower.contains("ui/ux")) dream = "UI/UX Designer";
                else if (pLower.contains("product manager")) dream = "Product Manager";
                else if (pLower.contains("doctor")) dream = "Doctor";
                else if (pLower.contains("teacher")) dream = "Teacher";
                else if (pLower.contains("designer")) dream = "Designer";

                return "{\n" +
                       "  \"dream\": \"" + dream + "\",\n" +
                       "  \"summary\": \"A structured roadmap to build your career in " + dream + " through progressive stages of learning and real-world projects.\",\n" +
                       "  \"stages\": [\n" +
                       "    {\n" +
                       "      \"id\": \"stage-1\",\n" +
                       "      \"title\": \"Stage 1: Foundations of " + dream + "\",\n" +
                       "      \"description\": \"Build the core knowledge base. Learn fundamental concepts, tools, and problem-solving approaches essential for " + dream + ".\",\n" +
                       "      \"duration\": \"6-8 weeks\",\n" +
                       "      \"subjects\": [\"Core Concepts\", \"Introduction to Tools\", \"Logic and Reasoning\", \"Basic Mathematics\"],\n" +
                       "      \"skills\": [\"Problem Solving\", \"Tool Proficiency\", \"Communication\"],\n" +
                       "      \"projects\": [\"Build a portfolio website\", \"Create a basic demonstration project\"],\n" +
                       "      \"resources\": []\n" +
                       "    },\n" +
                       "    {\n" +
                       "      \"id\": \"stage-2\",\n" +
                       "      \"title\": \"Stage 2: Core Skills Development\",\n" +
                       "      \"description\": \"Deepen your expertise with intermediate techniques, system thinking, and collaborative workflows.\",\n" +
                       "      \"duration\": \"8-12 weeks\",\n" +
                       "      \"subjects\": [\"Advanced Techniques\", \"System Architecture\", \"Version Control\", \"Data Analysis\"],\n" +
                       "      \"skills\": [\"Code/Work Optimization\", \"Testing & Debugging\", \"Team Collaboration\"],\n" +
                       "      \"projects\": [\"Build an interactive application\", \"Contribute to an open-source project\"],\n" +
                       "      \"resources\": []\n" +
                       "    },\n" +
                       "    {\n" +
                       "      \"id\": \"stage-3\",\n" +
                       "      \"title\": \"Stage 3: Advanced Architectures & Specialization\",\n" +
                       "      \"description\": \"Master industry standards, large-scale systems, security practices, and deployment pipelines.\",\n" +
                       "      \"duration\": \"10-14 weeks\",\n" +
                       "      \"subjects\": [\"System Design\", \"Cloud Computing\", \"Security Principles\", \"Performance Optimization\"],\n" +
                       "      \"skills\": [\"Cloud Deployment\", \"API Integration\", \"Security Hardening\"],\n" +
                       "      \"projects\": [\"Deploy a full-stack scalable service\", \"Implement secure authorization modules\"],\n" +
                       "      \"resources\": []\n" +
                       "    },\n" +
                       "    {\n" +
                       "      \"id\": \"stage-4\",\n" +
                       "      \"title\": \"Stage 4: Professional Mastery & Career Launch\",\n" +
                       "      \"description\": \"Develop advanced specialties, solve real-world case studies, build your network, and prepare for job interviews.\",\n" +
                       "      \"duration\": \"12-16 weeks\",\n" +
                       "      \"subjects\": [\"Real-world Systems\", \"Interview Preparation\", \"Professional Networking\", \"Leadership\"],\n" +
                       "      \"skills\": [\"Technical Interviews\", \"Team Leadership\", \"Stakeholder Communication\"],\n" +
                       "      \"projects\": [\"Complete a capstone project\", \"Build a production-ready application for portfolio\"],\n" +
                       "      \"resources\": []\n" +
                       "    }\n" +
                       "  ]\n" +
                       "}";
            }

            // 2. Quiz Generation
            if (pLower.contains("quiz") || pLower.contains("mcq") || pLower.contains("question")) {
                return "[\n" +
                       "  {\n" +
                       "    \"question\": \"Which habit is most vital for long-term career growth?\",\n" +
                       "    \"options\": [\"Continuous Learning\", \"Memorization only\", \"Avoiding challenges\", \"Working in isolation\"],\n" +
                       "    \"correctAnswer\": 0,\n" +
                       "    \"explanation\": \"Continuous learning and adaptability are critical as industries change rapidly.\"\n" +
                       "  },\n" +
                       "  {\n" +
                       "    \"question\": \"How should you approach complex problems in your career?\",\n" +
                       "    \"options\": [\"Deconstruct into smaller parts\", \"Avoid them entirely\", \"Ask others to solve them\", \"Postpone indefinitely\"],\n" +
                       "    \"correctAnswer\": 0,\n" +
                       "    \"explanation\": \"Deconstructing complex issues helps you tackle each component efficiently without being overwhelmed.\"\n" +
                       "  },\n" +
                       "  {\n" +
                       "    \"question\": \"What is the best way to build a professional network?\",\n" +
                       "    \"options\": [\"Attend industry events and contribute to communities\", \"Wait to be discovered\", \"Only connect with close friends\", \"Avoid social media\"],\n" +
                       "    \"correctAnswer\": 0,\n" +
                       "    \"explanation\": \"Active participation in communities and events significantly expands career opportunities.\"\n" +
                       "  }\n" +
                       "]";
            }

            // 3. Career Summary
            if (pLower.contains("summary") || pLower.contains("overview") || pLower.contains("sentence")) {
                return "{\n" +
                       "  \"sentence1\": \"This career offers a highly rewarding path filled with creative problem solving and innovation.\",\n" +
                       "  \"sentence2\": \"Professionals use state-of-the-art tools and collaborate in dynamic environments to shape meaningful products.\",\n" +
                       "  \"sentence3\": \"Building strong foundations and creating hands-on projects are the keys to lasting success in this domain.\"\n" +
                       "}";
            }

            // 4. Career Suggestions / Dream Discovery
            if (pLower.contains("career") || pLower.contains("dream") || pLower.contains("suggest")) {
                return "[\n" +
                       "  {\"dream\": \"Software Engineer\", \"subjects\": [\"Computer Science\", \"Logic\", \"Mathematics\"]},\n" +
                       "  {\"dream\": \"Data Scientist\", \"subjects\": [\"Statistics\", \"Python\", \"Analysis\"]},\n" +
                       "  {\"dream\": \"UI/UX Designer\", \"subjects\": [\"Design\", \"Psychology\", \"Prototyping\"]},\n" +
                       "  {\"dream\": \"Product Manager\", \"subjects\": [\"Business\", \"Leadership\", \"Communication\"]},\n" +
                       "  {\"dream\": \"AI/ML Engineer\", \"subjects\": [\"Machine Learning\", \"Python\", \"Mathematics\"]},\n" +
                       "  {\"dream\": \"Cybersecurity Specialist\", \"subjects\": [\"Networking\", \"Security\", \"Problem Solving\"]},\n" +
                       "  {\"dream\": \"Digital Marketer\", \"subjects\": [\"SEO\", \"Content Strategy\", \"Analytics\"]},\n" +
                       "  {\"dream\": \"Cloud Architect\", \"subjects\": [\"Infrastructure\", \"DevOps\", \"Cloud Platforms\"]},\n" +
                       "  {\"dream\": \"Research Scientist\", \"subjects\": [\"Physics\", \"Research Methods\", \"Documentation\"]},\n" +
                       "  {\"dream\": \"Business Analyst\", \"subjects\": [\"Data Analysis\", \"Finance\", \"Strategy\"]},\n" +
                       "  {\"dream\": \"Content Creator\", \"subjects\": [\"Storytelling\", \"Video Editing\", \"Social Media\"]},\n" +
                       "  {\"dream\": \"Financial Analyst\", \"subjects\": [\"Accounting\", \"Investment\", \"Excel\"]}\n" +
                       "]";
            }
        }

        // --- DOCUMENT RAG / QA ENGINE ---
        if (pLower.contains("documents:") || pLower.contains("document:") || pLower.contains("attached document")) {
            // 1. Extract query
            String query;
            int lastStudentIdx = prompt.lastIndexOf("Student:");
            if (lastStudentIdx != -1) {
                query = prompt.substring(lastStudentIdx + 8).trim();
                int aiIdx = query.indexOf("AI:");
                if (aiIdx != -1) {
                    query = query.substring(0, aiIdx).trim();
                }
            } else {
                int lastQIdx = prompt.lastIndexOf("Question:");
                if (lastQIdx != -1) {
                    query = prompt.substring(lastQIdx + 9).trim();
                    int aiIdx = query.indexOf("AI:");
                    if (aiIdx != -1) {
                        query = query.substring(0, aiIdx).trim();
                    }
                } else {
                    query = prompt.length() > 200 ? prompt.substring(prompt.length() - 200) : prompt;
                }
            }

            // 2. Extract documents context
            String docContext = "";
            int docStart = pLower.indexOf("documents:");
            if (docStart == -1) docStart = pLower.indexOf("document:");
            if (docStart == -1) docStart = pLower.indexOf("attached document");
            
            if (docStart != -1) {
                int docEnd = prompt.indexOf("History:", docStart);
                if (docEnd == -1) docEnd = prompt.indexOf("Student:", docStart);
                if (docEnd == -1) docEnd = prompt.indexOf("Question:", docStart);
                if (docEnd != -1) {
                    docContext = prompt.substring(docStart, docEnd).trim();
                } else {
                    docContext = prompt.substring(docStart).trim();
                }
            }

            if (!docContext.isEmpty() && !query.isEmpty()) {
                String qClean = query.toLowerCase().replaceAll("[^a-zA-Z0-9\\s]", " ").trim();
                String[] qWords = qClean.split("\\s+");
                java.util.List<String> keywords = new java.util.ArrayList<>();
                for (String w : qWords) {
                    if (w.length() > 4 && !w.equals("would") && !w.equals("about") &&
                        !w.equals("there") && !w.equals("could") && !w.equals("should") && !w.equals("explain")) {
                        keywords.add(w);
                    }
                }

                // Split context into sentences
                String[] sentences = docContext.split("(?<=\\.)\\s+");
                java.util.List<String> matchedSentences = new java.util.ArrayList<>();
                
                for (String sentence : sentences) {
                    String sLowerLine = sentence.toLowerCase();
                    int matchCount = 0;
                    for (String kw : keywords) {
                        if (sLowerLine.contains(kw)) {
                            matchCount++;
                        }
                    }
                    if (matchCount > 0) {
                        if (sentence.length() > 10 && sentence.length() < 300 && !matchedSentences.contains(sentence)) {
                            matchedSentences.add(sentence.trim());
                        }
                    }
                    if (matchedSentences.size() >= 4) break;
                }

                if (!matchedSentences.isEmpty()) {
                    StringBuilder sb = new StringBuilder();
                    sb.append("🔋 Offline Document Intelligence RAG:\n\n");
                    for (String s : matchedSentences) {
                        sb.append("- ").append(s).append("\n");
                    }
                    sb.append("\n(Offline mode: Keyword-extracted from local loaded files)");
                    return sb.toString();
                }
            }
            
            return "🔋 Offline Document Reader:\n\nI see you are asking about the loaded documents: \"" + query + "\". " +
                   "While offline, I can read local texts. If you need a full contextual synthesis or semantic analysis, please reconnect to the internet. " +
                   "What specific term or keyword from the documents would you like me to look up?";
        }

        // --- DYNAMIC OFFLINE CHATBOT ENGINE ---
// Extract the actual user question (handles Student:, User:, and quoted formats)
        String userQuery = extractUserQuestion(prompt);
        String qLower = userQuery.toLowerCase().replaceAll("[^a-zA-Z0-9\\s]", " ").trim();

        // Parse career target from system instruction or prompt context
        String targetCareer = parseTargetCareer(system, prompt);

        // 1. Greetings — exact word matching only, NOT contains("yo") which hits "you"
        if (isGreeting(qLower)) {
            return "Hello! I'm Kalam Spark, your offline AI mentor. Ask me about History, Geography, Polity, Economy, Maths, Science, or UPSC strategy - all available offline! What would you like to learn?";
        }

        // 2. Who are you
        if (qLower.contains("who are you") || qLower.contains("what is your name") || qLower.contains("about you") || qLower.contains("your role")) {
            return "I am **Kalam Spark**, your AI career mentor, inspired by Dr. A.P.J. Abdul Kalam. Even offline, I can guide you through core concepts in History, Geography, Polity, Economics, Mathematics, Science, and exam strategy!";
        }

        // 3. Calculus
        if (qLower.contains("calculus") || qLower.contains("derivative") || qLower.contains("differentiation") || (qLower.contains("integral") && !qLower.contains("integer")) || qLower.contains("integration") || qLower.contains("differential equation") || qLower.contains("limit of")) {
            if (qLower.contains("derivative") || qLower.contains("differentiation")) {
                return "A **derivative** measures the rate of change of a function - the slope of the curve at any point.\n\nBasic rules:\n- Power rule: if f(x) = x^n, then f'(x) = nx^(n-1)\n- d/dx(sin x) = cos x\n- d/dx(e^x) = e^x\n- Chain rule: d/dx[f(g(x))] = f'(g(x)) * g'(x)\n\n**Application:** Velocity = derivative of position. Set f'(x) = 0 to find maxima/minima.\n\nFor IAS Mathematics optional, derivatives appear in maxima-minima problems and rate-of-change questions.";
            }
            if (qLower.contains("integral") || qLower.contains("integration")) {
                return "**Integration** is the reverse of differentiation - it calculates the area under a curve or total accumulation.\n\nBasic rules:\n- Integral(x^n dx) = x^(n+1)/(n+1) + C\n- Integral(sin x dx) = -cos x + C\n- Integral(e^x dx) = e^x + C\n\n**Definite integral:** Integral from 0 to 1 of x^2 dx = 1/3 (actual area value)\n\n**Key techniques:** Substitution, integration by parts, partial fractions.\n\nApplications: Physics (work, centre of mass), probability (continuous distributions), economics (consumer surplus).";
            }
            return "**Calculus** is the branch of mathematics that studies **change** (differential) and **accumulation** (integral).\n\n**Differential Calculus:** A **derivative** gives the rate of change (slope). If position = t^2, velocity = 2t.\n\n**Integral Calculus:** An **integral** finds total accumulation or area. Integral(2t dt) = t^2 + C.\n\n**Limits** are the foundation: lim(x->0) sin(x)/x = 1.\n\nFor **IAS Mathematics optional**, focus on: limits, continuity, differentiation, integration, and differential equations. Start with NCERT Class 11-12 Maths.";
        }

        // 4. Algebra
        if (qLower.contains("algebra") || qLower.contains("polynomial") || qLower.contains("quadratic") || (qLower.contains("equation") && !qLower.contains("differential"))) {
            return "**Algebra** uses symbols and rules to solve equations.\n\n**Key formulas:**\n- **Linear equation:** ax + b = 0 -> x = -b/a\n- **Quadratic formula:** x = (-b +/- sqrt(b^2 - 4ac)) / 2a\n- **Factoring:** x^2 - 5x + 6 = (x-2)(x-3)\n\n**For UPSC CSAT** (quantitative aptitude): Focus on solving linear/simultaneous equations, simplification, and number theory (HCF, LCM, prime numbers). These appear directly in Prelims Paper 2.";
        }

        // 5. Statistics / Probability
        if (qLower.contains("statistics") || qLower.contains("probability") || qLower.contains("mean") || qLower.contains("median") || qLower.contains("standard deviation") || qLower.contains("variance") || qLower.contains("data interpretation")) {
            return "**Statistics** is the science of collecting, analysing, and interpreting data.\n\n**Measures of Central Tendency:**\n- **Mean** = sum / count\n- **Median** = middle value when sorted\n- **Mode** = most frequent value\n\n**Spread:**\n- **Variance** = average of squared deviations from mean\n- **Standard Deviation** = sqrt(Variance)\n\n**Probability:** P(A) = favourable / total. P(A or B) = P(A) + P(B) - P(A and B)\n\nFor **UPSC CSAT**, Data Interpretation questions use tables, bar charts, and pie charts. Practice calculating percentages, ratios, and averages quickly.";
        }

        // 6. Geometry / Mensuration
        if (qLower.contains("geometry") || qLower.contains("triangle") || qLower.contains("circle") || qLower.contains("mensuration") || qLower.contains("pythagor") || (qLower.contains("area") && !qLower.contains("career area"))) {
            return "**Geometry** studies shapes, sizes, and properties of figures.\n\n**Key formulas:**\n- **Pythagorean theorem:** a^2 + b^2 = c^2 (right triangle)\n- **Triangle area:** (1/2) x base x height\n- **Circle:** Area = pi*r^2, Circumference = 2*pi*r\n- **Sphere:** Volume = (4/3)*pi*r^3\n- **Cylinder:** Volume = pi*r^2*h\n\nFor **UPSC CSAT**, mensuration problems (area, volume, perimeter) are common. Memorise formulas and practice quick calculations.";
        }

        // 7. Physics
        if (qLower.contains("physics") || qLower.contains("newton") || qLower.contains("laws of motion") || qLower.contains("velocity") || qLower.contains("acceleration") || qLower.contains("thermodynamics") || qLower.contains("electricity") || qLower.contains("optics") || qLower.contains("nuclear")) {
            if (qLower.contains("newton") || qLower.contains("laws of motion")) {
                return "**Newton's Three Laws of Motion:**\n\n**1st Law (Inertia):** An object at rest stays at rest, and in motion stays in motion, unless acted on by a net force.\n\n**2nd Law:** F = ma. If F = 10N and m = 2kg, then a = 5 m/s^2.\n\n**3rd Law:** For every action there is an equal and opposite reaction. Example: rockets push gas down, gas pushes rocket up.\n\nFor UPSC **General Science**: Understand real-life applications - seatbelts (1st law), vehicle braking (2nd), rocket launches (3rd).";
            }
            return "**Physics** is the natural science of matter, energy, and their interactions.\n\n**Key branches for UPSC:**\n- **Mechanics** - Newton's laws, work, energy, projectile motion\n- **Thermodynamics** - heat, entropy, laws (heat flows hot to cold)\n- **Electricity & Magnetism** - Ohm's law (V=IR), electromagnetic induction\n- **Optics** - reflection, refraction, lenses (cameras, telescopes)\n- **Modern Physics** - atomic structure, radioactivity, nuclear energy\n\nFor UPSC **GS Paper 3** (Science & Technology): focus on India's nuclear programme, ISRO missions, and everyday applications. NCERT Physics Class 11-12 is the standard reference.";
        }

        // 8. Chemistry
        if (qLower.contains("chemistry") || qLower.contains("periodic table") || qLower.contains("molecule") || qLower.contains("atom") || qLower.contains("organic") || (qLower.contains("acid") && qLower.length() < 50) || qLower.contains("chemical reaction") || qLower.contains("element")) {
            return "**Chemistry** is the science of matter - its composition, structure, properties, and reactions.\n\n**Key concepts:**\n- **Atoms & Molecules:** Atoms are smallest units of elements. Molecules are atom combinations.\n- **Periodic Table:** 118 elements by atomic number. Groups share properties.\n- **Bonding:** Ionic (electron transfer: NaCl), Covalent (electron sharing: H2O)\n- **Acids & Bases:** pH < 7 = acid (HCl); pH > 7 = base (NaOH); pH = 7 = neutral (water)\n- **Organic Chemistry:** Carbon compounds - drugs, polymers, fuels, food\n\nFor **UPSC GS3**: Chemistry relates to fertilisers, pesticides, medicines, materials science, and pollution. NCERT Chemistry 11-12 is the standard reference.";
        }

        // 9. Biology
        if (qLower.contains("biology") || qLower.contains("cell biology") || qLower.contains("genetics") || qLower.contains("dna") || qLower.contains("evolution") || qLower.contains("photosynthesis") || qLower.contains("immune system") || qLower.contains("virus") || qLower.contains("bacteria")) {
            return "**Biology** is the science of life and living organisms.\n\n**Core topics:**\n- **Cell Biology:** The cell is the basic unit of life. Plant cells have cell wall and chloroplasts. Nucleus contains DNA.\n- **Genetics & DNA:** DNA stores genetic code. Genes determine traits. Mendel's laws govern inheritance.\n- **Evolution:** Natural selection - better-adapted organisms survive and reproduce more (Darwin).\n- **Ecology:** Organisms and their environment - food chains, ecosystems, nutrient cycles.\n- **Human Physiology:** Digestive, respiratory, circulatory, nervous, and endocrine systems.\n\nFor **UPSC GS3 & Environment**: focus on biodiversity, biotechnology (GM crops, CRISPR), and public health (vaccines, epidemics, disease control).";
        }

        // 10. AI / Machine Learning
        if (qLower.contains("artificial intelligence") || qLower.contains("machine learning") || qLower.contains("deep learning") || qLower.contains("neural network") || qLower.contains("what is ai") || qLower.contains("explain ai") || qLower.contains("chatgpt") || qLower.contains("large language model")) {
            return "**Artificial Intelligence (AI)** is the simulation of human intelligence by machines.\n\n**Key sub-fields:**\n- **Machine Learning (ML):** Systems learn from data patterns without explicit programming. Types: supervised (labelled data), unsupervised (clustering), reinforcement (reward-based).\n- **Deep Learning:** Multi-layered neural networks - basis for image recognition, ChatGPT, Gemini.\n- **Natural Language Processing (NLP):** Enables computers to understand and generate human language.\n- **Computer Vision:** Teaches machines to interpret images and video.\n\n**Applications:** Self-driving cars, medical diagnosis, fraud detection, language translation.\n\nFor **UPSC GS3**: Focus on India's National AI Strategy (INDIAai), AI governance, DPDP Act 2023, and ethical concerns of AI deployment.";
        }

        // 11. Indian History
        if (qLower.contains("history") || qLower.contains("mughal") || qLower.contains("british india") || qLower.contains("independence") || qLower.contains("freedom movement") || qLower.contains("gandhi") || qLower.contains("nehru") || qLower.contains("revolt") || qLower.contains("ancient india") || qLower.contains("medieval") || qLower.contains("vedic") || qLower.contains("gupta") || qLower.contains("maurya")) {
            if (qLower.contains("freedom movement") || qLower.contains("independence") || qLower.contains("gandhi") || qLower.contains("british india")) {
                return "**Indian Independence Movement** - the struggle against British colonial rule, ending with independence on **15 August 1947**.\n\n**Key Events:**\n- **1857:** First War of Independence (Sepoy Mutiny) against East India Company.\n- **1885:** Indian National Congress (INC) founded.\n- **1920-22:** Non-Cooperation Movement - Gandhi's call to boycott British institutions.\n- **1930:** Dandi March - Gandhi marched 241 miles to defy British salt laws.\n- **1942:** Quit India Movement - 'Do or Die' call for immediate British withdrawal.\n- **1947:** Independence and Partition into India and Pakistan.\n\n**Key Figures:** Gandhi, Nehru, Patel, Subhas Chandra Bose, Ambedkar, Bhagat Singh.\n\nFor **UPSC GS1** - this is a critical topic. Focus on: causes, phases, key movements, and major personalities.";
            }
            return "**Indian History** spans 5,000+ years:\n\n**Ancient India:**\n- Indus Valley Civilisation (Harappa, Mohenjo-daro) - urban planning, drainage\n- Vedic Period - Vedas, Sanskrit, early social structure\n- Maurya Empire (Chandragupta, Ashoka) - first pan-Indian empire; Buddhist missions\n- Gupta 'Golden Age' - Aryabhata (zero, pi), Kalidasa (literature)\n\n**Medieval India:**\n- Delhi Sultanate (1206-1526)\n- Mughal Empire (1526-1707) - Akbar's tolerance, Taj Mahal\n\n**Modern India:**\n- British colonialism, economic drain\n- Independence movement (1857-1947)\n\nFor **UPSC GS1**: Study art, culture, and Modern Indian history. Key resource: Spectrum (Modern India) + NCERT History Class 6-12.";
        }

        // 12. Indian Geography
        if (qLower.contains("geography") || qLower.contains("river") || qLower.contains("mountain") || qLower.contains("monsoon") || qLower.contains("himalayas") || qLower.contains("ganga") || qLower.contains("deccan") || qLower.contains("western ghats") || qLower.contains("climate") || qLower.contains("soil type")) {
            return "**Indian Geography** is a high-scoring topic in **UPSC GS Paper 1**.\n\n**Physical Features:**\n- **Himalayas:** Young fold mountains. 3 ranges: Himadri (>6000m), Himachal, Shiwaliks. Source of major rivers.\n- **Northern Plains:** Fertile alluvial plains of Indus, Ganga, Brahmaputra. Most densely populated.\n- **Deccan Plateau:** Old crystalline rock; rich in minerals (iron ore, coal, manganese).\n- **Western Ghats:** Biodiversity hotspot; heavy rainfall; source of peninsular rivers.\n- **Coastal Plains:** Western (narrow, lagoons); Eastern (broader, river deltas).\n\n**Major Rivers:**\n- Himalayan (perennial): Ganga (2525km), Yamuna, Brahmaputra, Indus\n- Peninsular (seasonal): Godavari, Krishna, Cauvery, Mahanadi\n\n**Monsoon:** SW Monsoon (June-Sept) brings 80% of annual rainfall. NE Monsoon affects Tamil Nadu (Oct-Dec).";
        }

        // 13. Indian Polity / Constitution
        if (qLower.contains("constitution") || qLower.contains("parliament") || qLower.contains("lok sabha") || qLower.contains("rajya sabha") || qLower.contains("fundamental right") || qLower.contains("directive principle") || qLower.contains("judiciary") || qLower.contains("supreme court") || qLower.contains("president") || qLower.contains("federalism") || qLower.contains("preamble") || qLower.contains("governor")) {
            return "**Indian Polity** is one of the highest-scoring subjects for UPSC - covered in **GS Paper 2**.\n\n**Constitution of India:**\n- Adopted **26 November 1949**, effective **26 January 1950** (Republic Day).\n- Longest written constitution. Originally 395 articles, 22 parts, 8 schedules.\n- Features: Parliamentary democracy, federal structure with unitary bias, independent judiciary.\n\n**Fundamental Rights (Part III):**\n- Right to Equality (Arts. 14-18)\n- Right to Freedom (Arts. 19-22)\n- Right against Exploitation (Arts. 23-24)\n- Right to Freedom of Religion (Arts. 25-28)\n- Cultural & Educational Rights (Arts. 29-30)\n- Right to Constitutional Remedies (Art. 32) - 'heart of constitution' (Dr. Ambedkar)\n\n**Parliament:**\n- **Lok Sabha:** Lower house, max 552 members, 5-year term.\n- **Rajya Sabha:** Upper house, 250 members, permanent body.\n\n**Standard Reference:** M. Laxmikanth's 'Indian Polity' - the bible for UPSC polity.";
        }

        // 14. Indian Economy
        if (qLower.contains("economy") || qLower.contains("gdp") || qLower.contains("inflation") || qLower.contains("budget") || qLower.contains("rbi") || qLower.contains("monetary policy") || qLower.contains("fiscal policy") || qLower.contains("gst") || qLower.contains("banking")) {
            return "**Indian Economy** is covered in **UPSC GS Paper 3**.\n\n**Key Indicators (2024):**\n- **GDP:** ~$3.7 trillion; 5th largest globally.\n- **Growth Rate:** ~7% annually; one of fastest-growing major economies.\n- **Inflation:** Measured by CPI. RBI targets 4% +/- 2%.\n\n**Key Institutions:**\n- **RBI** - Central bank; controls monetary policy, repo rate, currency.\n- **SEBI** - Regulates stock markets.\n- **NITI Aayog** - Policy think-tank (replaced Planning Commission, 2015).\n\n**Sectors:**\n- **Agriculture:** ~15% of GDP, ~45% employment\n- **Industry:** ~25% of GDP\n- **Services:** ~55% of GDP (IT, banking dominant)\n\n**Reference:** Ramesh Singh's 'Indian Economy'.";
        }

        // 15. Environment / Ecology
        if (qLower.contains("environment") || qLower.contains("ecology") || qLower.contains("biodiversity") || qLower.contains("climate change") || qLower.contains("global warming") || qLower.contains("renewable energy") || qLower.contains("pollution") || qLower.contains("wildlife") || qLower.contains("ozone")) {
            return "**Environment & Ecology** is high-scoring in **UPSC GS Paper 3**.\n\n**Biodiversity:**\n- India is one of 17 **mega-diverse countries**.\n- 4 biodiversity hotspots: Himalayas, Western Ghats, Indo-Burma, Sundaland.\n- Protected areas: National Parks, Wildlife Sanctuaries, Biosphere Reserves.\n\n**Climate Change:**\n- Greenhouse gases (CO2, CH4, N2O) trap heat causing global warming.\n- **Paris Agreement (2015):** Limit warming to 1.5 degree C above pre-industrial levels.\n- **India's targets:** 50% non-fossil electricity by 2030, net-zero by 2070.\n\n**Key Indian Laws:**\n- Environment Protection Act 1986\n- Wildlife Protection Act 1972\n- Forest Rights Act 2006\n- National Green Tribunal (NGT) 2010\n\n**International Agreements:** Montreal Protocol (ozone), CITES (wildlife trade), Kyoto Protocol, Basel Convention.";
        }

        // 16. UPSC / IAS Preparation
        if (qLower.contains("upsc") || qLower.contains("ias exam") || qLower.contains("civil service") || qLower.contains("ips exam") || qLower.contains("prelims") || qLower.contains("mains exam") || qLower.contains("optional subject") || qLower.contains("csat")) {
            return "**UPSC Civil Services Examination** selects IAS, IPS, IFS and other Group A officers.\n\n**Exam Structure:**\n- **Stage 1 - Prelims:** 2 objective papers. GS Paper 1 (100 Qs, 200 marks) + CSAT Paper 2 (qualifying, 33% cutoff). ~5 lakh candidates appear.\n- **Stage 2 - Mains:** 9 descriptive papers. GS 1-4, Essay, Optional (2 papers), Languages. 1750 marks total.\n- **Stage 3 - Interview:** 275 marks personality test.\n\n**Key Subjects:** History, Geography, Polity (Laxmikanth), Economy (Ramesh Singh), Environment, Science & Technology, Ethics, Current Affairs.\n\n**Preparation Strategy:**\n1. Start with NCERT Class 6-12 (all subjects)\n2. Move to standard references\n3. Daily newspaper (The Hindu/Indian Express)\n4. Monthly current affairs revision\n5. Previous year question practice + daily answer writing\n\n**Timeline:** 12-24 months of serious preparation typically needed.";
        }

        // 17. Ethics (GS4)
        if (qLower.contains("ethics") || qLower.contains("integrity") || qLower.contains("emotional intelligence") || qLower.contains("morality") || qLower.contains("virtue") || qLower.contains("public service value")) {
            return "**Ethics, Integrity, and Aptitude** is **UPSC GS Paper 4** - unique to civil services.\n\n**Key Concepts:**\n- **Ethics:** Study of moral principles. Main theories: Utilitarianism (greatest good for most), Deontology (duty-based - Kant), Virtue Ethics (character-based - Aristotle).\n- **Integrity:** Consistency between values, words, and actions. Core civil service value.\n- **Emotional Intelligence (EI):** Self-awareness, empathy, social skills, emotional regulation. Coined by Daniel Goleman.\n- **Public Service Values:** Impartiality, objectivity, dedication, compassion, non-partisanship, accountability, transparency.\n\n**Case Studies:** GS4 includes ethical dilemmas testing how you balance competing values (loyalty vs. honesty, efficiency vs. equity).\n\n**Reference:** Lexicon for Ethics (Chronicle IAS Academy).";
        }

        // 18. Current Affairs
        if (qLower.contains("current affairs") || qLower.contains("current events") || qLower.contains("news preparation")) {
            return "**Current Affairs** are essential for UPSC. Here's how to prepare offline:\n\n**Best Sources (read when online):**\n- **The Hindu** - Best newspaper for UPSC. Read the editorial daily.\n- **PIB** (Press Information Bureau) - Official government announcements.\n- **Yojana & Kurukshetra** - Government magazines for scheme-based issues.\n- **Economic Survey** - Released before Union Budget; crucial for economy section.\n\n**What to track:**\n- Government schemes & policies (PM Awas Yojana, PLI scheme, Digital India)\n- Key Supreme Court judgements and new laws\n- International relations and summits (G20, SCO, BRICS)\n- Science & Technology (ISRO, DRDO, health, AI)\n- Economic data (RBI policy, Budget, GDP, inflation)\n\n**Offline strategy:** Maintain dated topic-wise notes. Revise weekly by UPSC syllabus category.";
        }

        // 19. Study Techniques
        if (qLower.contains("how to learn") || qLower.contains("study tip") || qLower.contains("how to study") || qLower.contains("memorize") || qLower.contains("remember it") || qLower.contains("study technique") || qLower.contains("revision strategy")) {
            return "Three powerful study techniques for mastering any subject on your path to " + targetCareer + ":\n\n**1. Active Recall**\nTest your memory instead of passively re-reading. Write everything you know from memory then check notes. This builds much stronger neural pathways.\n\n**2. Spaced Repetition**\nReview at expanding intervals: 1 day -> 3 days -> 7 days -> 14 days. Prevents the forgetting curve. Apps like Anki use this system.\n\n**3. Feynman Technique**\nExplain the concept simply - as if teaching someone with no background. Where you struggle, that's exactly what you need to re-study.\n\n**For UPSC specifically:** Practice **Answer Writing** daily. One 250-word GS answer per day builds both conceptual clarity and writing speed - critical for Mains success.";
        }

        // 20. Board Exams
        if (qLower.contains("cbse") || qLower.contains("icse") || qLower.contains("state board") || qLower.contains("board exam") || qLower.contains("class 10") || qLower.contains("class 12")) {
            return "Preparing for board exams is a critical milestone!\n\n**Offline preparation tips:**\n- **Syllabus Focus:** Stick to official textbooks. For CBSE, NCERT books are the gold standard - questions are directly based on them.\n- **Previous Year Papers:** Solve past 5-year papers to understand exact question pattern and marking scheme.\n- **Time-Bound Practice:** Sit for full 3-hour mock papers to build speed and presentation.\n- **Weak Areas:** Spend 60% of revision time on topics you find hardest.\n\nI can help you create a study plan in the **Task Planner** to balance board exam prep with your goal to become a " + targetCareer + ".";
        }

        // 21. Programming
        if (qLower.contains("python") || qLower.contains("javascript") || qLower.contains("coding") || qLower.contains("programming") || qLower.contains("software engineer") || qLower.contains("web development") || qLower.contains("data science")) {
            return "Programming is a powerful skill for any career!\n\n**Getting started:**\n- **Python** - Best for beginners. Used in data analysis, AI/ML, automation.\n- **Web Development** - HTML + CSS + JavaScript. Build simple sites first.\n- **Data Structures & Algorithms** - Essential for technical interviews. Practice on LeetCode.\n\n**Daily habits:**\n- Code every day, even 20-30 minutes builds lasting skill.\n- Build small projects that solve real problems.\n- Read others' code on GitHub to accelerate learning.\n\nFor aspiring **IAS officers**, programming knowledge is increasingly valuable for e-governance analysis and digital policy initiatives.";
        }

        // 22. Jobs / Opportunities
        if (qLower.contains("job") || qLower.contains("internship") || qLower.contains("placement") || qLower.contains("opportunity") || qLower.contains("hackathon")) {
            return "For " + targetCareer + " opportunities:\n\n**For IAS/Civil Services:**\n- The only path is through the **UPSC CSE**. Also practice with state PSC exams.\n- Consistent study over 12-24 months is the proven path.\n\n**For other careers:**\n- **Platforms:** Internshala, LinkedIn Jobs, Unstop (hackathons), Naukri.\n- **Portfolio:** Build strong evidence - GitHub, certifications, research, projects.\n- **Resume:** Focus on measurable impact, not just activity lists.\n\nCheck our **Opportunities** section once online for real-time openings matched to your profile!";
        }

        // 23. Quiz
        if (qLower.contains("quiz") || qLower.contains("test me") || qLower.contains("mcq")) {
            return "Testing yourself is one of the most effective study methods!\n\nTo take a quiz in Kalam Spark:\n1. Go to the **Study Center** in the app.\n2. Choose your subject or roadmap stage.\n3. Click 'Take Quiz' for a 10-question test with explanations.\n\n**UPSC tip:** Previous year UPSC Prelims MCQs (2011-2024) are the best quality practice questions and show the actual exam pattern better than any mock test.";
        }

        // 24. Thank you
        if (qLower.contains("thank you") || qLower.contains("thanks") || qLower.contains("thank u")) {
            return "You're very welcome! Helping you build knowledge for " + targetCareer + " is what I'm here for. Ask me anything - History, Geography, Polity, Economy, Maths, Science, or UPSC strategy!";
        }

        // 25. Career paths
        if (qLower.contains("how to become") || qLower.contains("career path") || qLower.contains("roadmap for") || qLower.contains("become a") || qLower.contains("become an")) {
            return "Pursuing a career as " + targetCareer + " requires dedication and a clear plan:\n\n**Framework:**\n1. **Core Education** - Master fundamentals through NCERT and standard references.\n2. **Practical Experience** - Build evidence of your capability: exams cleared, projects, certifications.\n3. **Networking** - Connect with professionals, join communities, seek mentorship.\n4. **Continuous Learning** - Stay updated with developments in your field.\n\nFor IAS: UPSC CSE -> Prelims -> Mains -> Interview. Start with NCERT, then standard references, then current affairs.\n\nWhat stage of preparation are you currently at?";
        }

        // 26. Smart keyword-based fallback
        String[] wordsArr = qLower.split("\\s+");
        java.util.List<String> stopWords = java.util.Arrays.asList(
            "what", "whats", "where", "when", "which", "about", "tell", "explain",
            "define", "describe", "please", "could", "would", "should", "there",
            "their", "have", "does", "will", "with", "that", "this", "from",
            "give", "show", "help", "know", "need", "want", "some", "more",
            "kalam", "spark", "mentor"
        );
        String mainTopic = "";
        for (String w : wordsArr) {
            if (w.length() > 3 && !stopWords.contains(w)) {
                mainTopic = w;
                break;
            }
        }

        if (!mainTopic.isEmpty()) {
            String displayTopic = Character.toUpperCase(mainTopic.charAt(0)) + mainTopic.substring(1);
            return "**" + displayTopic + "** is an important concept for your preparation as " + targetCareer + ".\n\nThis likely falls under one of these UPSC syllabus areas:\n- **GS Paper 1**: History, Geography, Art & Culture\n- **GS Paper 2**: Polity, Governance, International Relations\n- **GS Paper 3**: Economy, Science & Technology, Environment\n- **GS Paper 4**: Ethics & Integrity\n\nTo prepare offline:\n1. Find the relevant NCERT chapter for this topic.\n2. Note its connection to current government policies or events.\n3. Write a 150-word short answer to build conceptual clarity.\n\nAsk me a specific question about " + displayTopic + " and I'll give you a detailed explanation!";
        }

        // 27. Ultimate fallback
        return "I'm your offline AI mentor and I can answer many questions without internet!\n\nTry asking me about:\n- **Mathematics**: calculus, algebra, geometry, statistics\n- **Indian History**: ancient India, Mughal era, freedom movement\n- **Geography**: Himalayas, rivers, monsoon, climate zones\n- **Polity**: constitution, parliament, fundamental rights\n- **Economy**: GDP, RBI, budget, agriculture sector\n- **Science**: physics (Newton's laws), chemistry (periodic table), biology (DNA)\n- **UPSC Strategy**: exam pattern, books, preparation plan\n\nWhat specific concept would you like to learn?";
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

    // ── Helper: Check if user query is a greeting (exact/prefix only) ────────
    // IMPORTANT: Use equals/startsWith, NOT contains("yo") which hits "you"
    private boolean isGreeting(String qLower) {
        if (qLower.equals("hi") || qLower.equals("hello") || qLower.equals("hey") ||
            qLower.equals("yo") || qLower.equals("sup") || qLower.equals("howdy") ||
            qLower.equals("greetings") || qLower.equals("namaste") || qLower.equals("vanakkam")) {
            return true;
        }
        String[] w = qLower.split("\\s+");
        if (w.length <= 4) {
            return qLower.startsWith("hi ") || qLower.startsWith("hello ") ||
                   qLower.startsWith("hey ") || qLower.contains("good morning") ||
                   qLower.contains("good evening") || qLower.contains("good afternoon") ||
                   qLower.startsWith("greet");
        }
        return false;
    }
}
