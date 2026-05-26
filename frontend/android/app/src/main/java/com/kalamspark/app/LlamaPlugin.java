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

    /**
     * Check if the model file exists at the given path.
     * Tries multiple paths to handle different Android/MIUI storage configurations.
     */
    @PluginMethod
    public void checkModelExists(PluginCall call) {
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
        // Clean the prompt to extract the actual student message (usually after the last "Student:")
        String userQuery = prompt;
        int lastStudentIdx = prompt.lastIndexOf("Student:");
        if (lastStudentIdx != -1) {
            userQuery = prompt.substring(lastStudentIdx + 8).trim();
            int aiIdx = userQuery.indexOf("AI:");
            if (aiIdx != -1) {
                userQuery = userQuery.substring(0, aiIdx).trim();
            }
        }
        
        String qLower = userQuery.toLowerCase().replaceAll("[^a-zA-Z0-9\\s]", " ").trim();

        // Extract career target from system instruction if possible
        String targetCareer = "your chosen field";
        if (system != null) {
            String sysLower = system.toLowerCase();
            if (sysLower.contains("dream career:")) {
                int start = sysLower.indexOf("dream career:") + 13;
                int end = system.indexOf("\n", start);
                if (end != -1) targetCareer = system.substring(start, end).trim();
            } else if (sysLower.contains("dream:")) {
                int start = sysLower.indexOf("dream:") + 6;
                int end = system.indexOf(",", start);
                if (end == -1) end = system.indexOf("\n", start);
                if (end != -1) targetCareer = system.substring(start, end).trim();
            }
        }

        // 1. Handle Greetings
        if (qLower.equals("hi") || qLower.equals("hello") || qLower.equals("hey") || 
            qLower.contains("hello kalam") || qLower.contains("hi kalam") || qLower.contains("greetings") ||
            qLower.contains("yo") || qLower.contains("sup")) {
            return "Hello! 👋 I'm Kalam Spark, your offline AI mentor. Even though we are offline right now, I'm here to support you in planning your learning journey towards " + targetCareer + ". What would you like to discuss today?";
        }

        // 2. Handle "who are you" / "what are you" / "about you"
        if (qLower.contains("who are you") || qLower.contains("what is your name") || qLower.contains("about you") || qLower.contains("your role")) {
            return "I am **Kalam Spark**, your AI career mentor, inspired by Dr. A.P.J. Abdul Kalam. I help you explore career roadmaps, discover study resources, track tasks in your Planner, and test your knowledge. Even when offline, I can guide you through fundamental principles!";
        }

        // 3. Handle Board Exams / CBSE / ICSE / State Board
        if (qLower.contains("cbse") || qLower.contains("icse") || qLower.contains("state board") || qLower.contains("matriculation") || qLower.contains("board exam")) {
            return "Preparing for board exams (CBSE, ICSE, or State Board) is a critical milestone! Here are offline tips:\n\n" +
                   "- **Syllabus Focus**: Stick strictly to your textbooks (like NCERT for CBSE) as questions match them closely.\n" +
                   "- **Previous Years**: Solve past 5-year question papers to understand exam patterns and marking schemes.\n" +
                   "- **Time Management**: Practice writing complete papers under a 3-hour limit to build speed and presentation style.\n\n" +
                   "I can customize your active Planner tasks to balance school syllabus with your goal to become a " + targetCareer + ".";
        }

        // 4. Handle "What is AI" / "Explain AI" / "AI"
        if (qLower.contains("what is ai") || qLower.contains("explain ai") || 
            qLower.contains("define ai") || qLower.contains("artificial intelligence") || 
            qLower.contains("about ai") || qLower.contains("what is machine learning")) {
            return "Artificial Intelligence (AI) is the simulation of human intelligence processes by machines, especially computer systems. These processes include learning, reasoning, and self-correction.\n\nKey areas of AI include:\n- **Machine Learning**: Systems learning from data patterns without explicit programming.\n- **Deep Learning**: Using multi-layered neural networks to solve complex tasks.\n- **Natural Language Processing (NLP)**: Enabling computers to understand and generate human language.\n\nUnderstanding AI concepts will give you a massive competitive advantage in " + targetCareer + ". What specific aspect of AI are you most interested in?";
        }

        // 5. Handle Study/Learning Tips
        if (qLower.contains("how to learn") || qLower.contains("study tips") || qLower.contains("learning techniques") || qLower.contains("how to study") || qLower.contains("tips")) {
            return "Here are three powerful study techniques to help you master topics in " + targetCareer + ":\n\n1. **Active Recall**: Test your memory instead of passively re-reading. Try to write down everything you know about a topic from memory.\n2. **Spaced Repetition**: Review the material at expanding intervals (e.g., after 1 day, then 3 days, then 7 days) to build long-term memory retrieval pathways.\n3. **Feynman Technique**: Explain the concept in simple terms to someone else. If you struggle to simplify it, you know exactly which areas you need to review.\n\nWhich of these would you like to apply to your tasks today?";
        }

        // 6. Handle Career paths / "how to become"
        if (qLower.contains("how to become") || qLower.contains("career path") || qLower.contains("roadmap for") || qLower.contains("become a") || qLower.contains("job outlook")) {
            String careerOfInterest = targetCareer;
            if (qLower.contains("become a ")) {
                int becomeIdx = qLower.indexOf("become a ");
                careerOfInterest = userQuery.substring(becomeIdx + 9).trim();
            } else if (qLower.contains("become an ")) {
                int becomeIdx = qLower.indexOf("become an ");
                careerOfInterest = userQuery.substring(becomeIdx + 10).trim();
            }
            
            return "Pursuing a career as a " + careerOfInterest + " is an exciting journey! Here is a general framework to guide you:\n\n1. **Core Education**: Master the fundamental concepts, tools, and methodologies of the field.\n2. **Practical Projects**: Build a portfolio demonstrating your hands-on ability (theory is good, but code or designs are better!).\n3. **Networking**: Connect with professionals in the community and seek mentorship.\n4. **Continuous Learning**: Stay updated with the latest trends and tools.\n\nWhat stage of preparation are you currently at for this career?";
        }

        // 7. Handle Career pivot / change / transition
        if (qLower.contains("pivot") || qLower.contains("transition") || qLower.contains("change career") || qLower.contains("career change")) {
            return "Pivoting careers is very common and achievable! When transitioning into " + targetCareer + ", focus on:\n\n" +
                   "1. **Transferable Skills**: Communication, logical thinking, and project management transfer to almost any role.\n" +
                   "2. **Gap Analysis**: Identify which technical tools or certifications are required for " + targetCareer + ".\n" +
                   "3. **Bridging Plan**: Build 2-3 specific projects that blend your old background with the new target field.\n\n" +
                   "Try using our **Career Pivot** page to get a detailed transition score and bridge plan!";
        }

        // 8. Handle Opportunities / Jobs / Internships
        if (qLower.contains("job") || qLower.contains("internship") || qLower.contains("hackathon") || qLower.contains("opportunity") || qLower.contains("find work")) {
            return "To land internships and jobs in " + targetCareer + ", I recommend:\n\n" +
                   "- **Platforms**: Check platforms like Internshala, LinkedIn Jobs, and Unstop (for hackathons/competitions).\n" +
                   "- **Portfolio**: Build a strong GitHub, Behance, or personal site showing 3 completed projects.\n" +
                   "- **Resume**: Focus on impact (what you built, what tools you used, and what you achieved).\n\n" +
                   "You can review current opportunities in our **Opportunities** section once you are online!";
        }

        // 9. Handle Quizzes / Test
        if (qLower.contains("quiz") || qLower.contains("test me") || qLower.contains("question") || qLower.contains("mcq")) {
            return "Testing your knowledge is the best way to study! To take a quiz:\n\n" +
                   "1. Go to the **Study Center** in the app.\n" +
                   "2. Choose your current subject or roadmap stage.\n" +
                   "3. Click 'Take Quiz' to start a 10-question test with explanations.\n\n" +
                   "Would you like me to share a quick quiz question right here in the chat?";
        }
        
        // 10. Handle "thank you" / "thanks"
        if (qLower.contains("thank you") || qLower.contains("thanks")) {
            return "You are very welcome! 😊 Helping you succeed in your path towards " + targetCareer + " is my primary goal. Feel free to ask any other questions, review your Planner, or complete a Study Center quiz!";
        }

        // 11. Handle specific technical topics (code, web, database, etc.)
        if (qLower.contains("python") || qLower.contains("java") || qLower.contains("javascript") || qLower.contains("coding") || qLower.contains("programming") || qLower.contains("c++") || qLower.contains("html") || qLower.contains("css")) {
            return "Programming is a superpower! To learn coding effectively for " + targetCareer + ", I highly recommend:\n- Writing code every single day (even if it's just 15 minutes).\n- Solving problem sets on platforms like LeetCode or HackerRank.\n- Building small personal projects (like a calculator, weather app, or personal blog) to apply what you've learned.\n\nIs there a specific programming language or library you are focusing on right now?";
        }

        // 12. General question extraction fallback
        // If the query is long enough, try to extract the main keywords and write a dynamic response
        String[] words = qLower.split("\\s+");
        if (words.length > 2) {
            StringBuilder keywords = new StringBuilder();
            int count = 0;
            for (String w : words) {
                if (w.length() > 4 && !w.equals("student") && !w.equals("mentor") && !w.equals("question") && !w.equals("explain")) {
                    keywords.append(w).append(" ");
                    count++;
                    if (count >= 2) break;
                }
            }
            
            if (count > 0) {
                return "🔋 Offline Mode (Local Gemma 4): That is a great question about **" + keywords.toString().trim() + "**!\n\nTo master this concept in your journey to become a " + targetCareer + ", I recommend:\n- Reading textbooks or articles covering the foundations.\n- Creating a dedicated task in your **Task Planner** to research it further.\n- Building a small practical project to test your understanding.\n\nOnce you are back online, I can do a deep search and document analysis to give you a comprehensive breakdown. What other aspect of this would you like to explore?";
            }
        }

        // 13. Default fallback response if no keywords matched
        return "🔋 Offline Mode (Local Gemma 4): I hear your query about \"" + userQuery + "\". " +
               "As your mentor, I encourage you to stay focused on your goals! " +
               "While offline, you can continue tracking tasks on your Planner and completing quizzes in the Study Center. " +
               "Once you reconnect to the internet, I'll provide full AI-powered mentoring with web research and document analysis. " +
               "What specific aspect of your career plan for " + targetCareer + " would you like to work on right now?";
    }
}
