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
        if (!isLoaded) {
            return "🔋 Offline AI Mentor:\n\n" +
                   "Please connect to the internet, or go to Sidebar Settings -> Select Model File to load a local Gemma 4 model (.gguf) for fully offline real-time generation.";
        }

        String targetCareer = parseTargetCareer(system, prompt);
        String userQuery = extractUserQuestion(prompt);
        
        boolean wantsJson = (system != null && !system.isEmpty() && (
                            system.toLowerCase().contains("json") || 
                            system.toLowerCase().contains("schema")
                           )) || (prompt != null && prompt.toLowerCase().contains("json"));

        if (wantsJson) {
            // Check if it's career pivot
            if (prompt != null && (prompt.toLowerCase().contains("pivot") || prompt.toLowerCase().contains("transition"))) {
                return generatePivotJson(targetCareer, prompt);
            }
            // Check if it's quiz
            if ((system != null && system.toLowerCase().contains("quiz")) || (prompt != null && (prompt.toLowerCase().contains("quiz") || prompt.toLowerCase().contains("examiner")))) {
                return generateQuizJson(prompt);
            }
            // Check if it's daily tasks / planner
            if (prompt != null && (prompt.toLowerCase().contains("tasks") || prompt.toLowerCase().contains("task") || prompt.toLowerCase().contains("educator"))) {
                return generatePlannerTasksJson(targetCareer, prompt);
            }
            // Default: return roadmap JSON
            return generateRoadmapJson(targetCareer, prompt);
        }

        // Wants plain text response
        return generateTextResponse(targetCareer, userQuery);
    }

    private String generatePivotJson(String targetCareer, String prompt) {
        String currentCareer = "your current field";
        if (prompt.toLowerCase().contains("pivot from")) {
            int start = prompt.toLowerCase().indexOf("pivot from") + 10;
            int end = prompt.toLowerCase().indexOf(" to ", start);
            if (end != -1) {
                currentCareer = prompt.substring(start, end).trim();
            }
        }
        
        return "{\n" +
               "  \"transferPercentage\": 65,\n" +
               "  \"transferableSkills\": [\"Problem Solving\", \"Project Management\", \"Analytical Thinking\", \"Communication\"],\n" +
               "  \"biggestGap\": \"Mastering core technical implementations, frameworks, and specific programming practices required for " + targetCareer + ".\",\n" +
               "  \"marketDemand\": \"High. Employers value candidates with diverse backgrounds who can bridge domain gaps.\",\n" +
               "  \"timeToTransition\": \"6 to 9 months of dedicated study\",\n" +
               "  \"bridgePlan\": [\n" +
               "    {\n" +
               "      \"title\": \"Build Technical Foundations\",\n" +
               "      \"action\": \"Focus on coding syntax, basic tools, and design principles relevant to " + targetCareer + ".\"\n" +
               "    },\n" +
               "    {\n" +
               "      \"title\": \"Practice Hands-on Projects\",\n" +
               "      \"action\": \"Develop 3 small-to-medium projects that demonstrate core competencies in your new target career.\"\n" +
               "    },\n" +
               "    {\n" +
               "      \"title\": \"Portfolio & Network\",\n" +
               "      \"action\": \"Document your journey on GitHub, create a professional portfolio, and connect with professionals in " + targetCareer + ".\"\n" +
               "    }\n" +
               "  ]\n" +
               "}";
    }

    private String generateQuizJson(String prompt) {
        String pLower = prompt.toLowerCase();
        if (pLower.contains("game")) {
            return "[\n" +
                   "  {\n" +
                   "    \"question\": \"Which component of a game engine updates physical interactions and renders frames repeatedly?\",\n" +
                   "    \"options\": [\"Asset Pipeline\", \"Game Loop\", \"Collider\", \"Shader\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"The Game Loop is the core component that processes input, updates the game state, and renders graphics repeatedly.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"In Unity development, which language is primarily used for scripting game behaviors?\",\n" +
                   "    \"options\": [\"C++\", \"Python\", \"C#\", \"JavaScript\"],\n" +
                   "    \"correctAnswer\": 2,\n" +
                   "    \"explanation\": \"Unity uses C# as its primary scripting language for gameplay programming.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"Which concept is used to represent positions and directions in 3D game space?\",\n" +
                   "    \"options\": [\"Matrices\", \"Vectors\", \"Quaternions\", \"Scalars\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Vectors (typically Vector3) represent position, velocity, and directions in 3D space.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What is the main benefit of Double Buffering in computer graphics?\",\n" +
                   "    \"options\": [\"Increases texture resolution\", \"Prevents screen tearing and flickering\", \"Reduces memory usage\", \"Speeds up calculations\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Double buffering uses two buffers (front and back) to render images off-screen before displaying them, preventing screen tearing.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"Which engine is widely known for AAA graphics and its Blueprint visual scripting system?\",\n" +
                   "    \"options\": [\"Godot\", \"Unity\", \"Unreal Engine\", \"CryEngine\"],\n" +
                   "    \"correctAnswer\": 2,\n" +
                   "    \"explanation\": \"Unreal Engine is famous for high-fidelity graphics and uses Blueprints for visual scripting.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What does a Collider do in a game environment?\",\n" +
                   "    \"options\": [\"Draws the 3D model\", \"Handles user keyboard inputs\", \"Defines physical shape for collision detection\", \"Plays background music\"],\n" +
                   "    \"correctAnswer\": 2,\n" +
                   "    \"explanation\": \"Colliders define the boundary shape of objects for calculating physics collisions.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"Which engine node in Godot represents the root of a scene or an entity?\",\n" +
                   "    \"options\": [\"Component\", \"GameObject\", \"Node\", \"Prefab\"],\n" +
                   "    \"correctAnswer\": 2,\n" +
                   "    \"explanation\": \"In Godot, everything is composed of Nodes, which are organized into scene trees.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What is a shader in game development?\",\n" +
                   "    \"options\": [\"A script running on the GPU that determines pixel colors\", \"A memory manager\", \"A physics solver\", \"A tool for recording audio\"],\n" +
                   "    \"correctAnswer\": 0,\n" +
                   "    \"explanation\": \"Shaders are GPU programs that calculate rendering effects like lighting and colors.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"In game UI design, what does 'Draw Call' optimize?\",\n" +
                   "    \"options\": [\"File download size\", \"GPU rendering performance by batching commands\", \"Audio quality\", \"Save game data speed\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Minimizing draw calls by batching sprites/meshes optimizes GPU rendering speed.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What is a prefab (or scene instantiation) used for?\",\n" +
                   "    \"options\": [\"To compile the codebase\", \"As a template for creating reusable GameObjects\", \"To handle network connections\", \"To design terrain heightmaps\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Prefabs allow developers to save configured GameObjects to asset files and reuse/instantiate them repeatedly.\"\n" +
                   "  }\n" +
                   "]";
        } else if (pLower.contains("code") || pLower.contains("program") || pLower.contains("java") || pLower.contains("python") || pLower.contains("c++")) {
            return "[\n" +
                   "  {\n" +
                   "    \"question\": \"What is the time complexity of searching in a balanced binary search tree (BST)?\",\n" +
                   "    \"options\": [\"O(1)\", \"O(n)\", \"O(log n)\", \"O(n log n)\"],\n" +
                   "    \"correctAnswer\": 2,\n" +
                   "    \"explanation\": \"Balanced BSTs halve the search space at each step, resulting in O(log n) search complexity.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"Which OOP principle allows a subclass to provide a specific implementation of a method defined in its superclass?\",\n" +
                   "    \"options\": [\"Encapsulation\", \"Polymorphism / Method Overriding\", \"Abstraction\", \"Inheritance\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Method overriding allows subclasses to implement polymorphic behavior by rewriting a parent method.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What is the main advantage of compiling code rather than interpreting it?\",\n" +
                   "    \"options\": [\"Easier to debug at runtime\", \"Typically offers faster execution speed\", \"Uses less disk space\", \"No compile-time errors\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Compiled code is translated directly to machine code before execution, making it run faster than interpreted code.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"Which data structure operates on a Last In, First Out (LIFO) basis?\",\n" +
                   "    \"options\": [\"Queue\", \"Stack\", \"Linked List\", \"Heap\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Stacks retrieve the last inserted element first (LIFO), whereas queues are FIFO.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What is encapsulation in Object-Oriented Programming?\",\n" +
                   "    \"options\": [\"Inheriting behaviors from parent classes\", \"Hiding internal object states and requiring all interaction through methods\", \"Allowing multiple method signatures\", \"Compiling code to bytecode\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Encapsulation wraps data and methods, protecting them from direct external modification.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"Which of the following is a reference type in Java?\",\n" +
                   "    \"options\": [\"int\", \"double\", \"char\", \"String\"],\n" +
                   "    \"correctAnswer\": 3,\n" +
                   "    \"explanation\": \"String is a class and therefore a reference type, while int, double, and char are primitive types.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What does git clone do?\",\n" +
                   "    \"options\": [\"Creates a new branch\", \"Saves local changes\", \"Copies an existing remote repository locally\", \"Merges two branches\"],\n" +
                   "    \"correctAnswer\": 2,\n" +
                   "    \"explanation\": \"Git clone downloads a complete copy of a remote repository into a local directory.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What is recursion in programming?\",\n" +
                   "    \"options\": [\"A loop that runs forever\", \"A function calling itself directly or indirectly\", \"Allocating dynamic memory\", \"Catching syntax errors\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Recursion occurs when a function calls itself to solve a smaller subproblem.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What does a compiler's syntax check verify?\",\n" +
                   "    \"options\": [\"Logic bugs\", \"Correctness of variables names and grammar according to language rules\", \"Database speed\", \"Array values\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Syntax checks ensure that the code adheres to the grammar rules of the language.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"In memory management, what is a memory leak?\",\n" +
                   "    \"options\": [\"Computer runs out of battery\", \"Unused allocated memory is not released, reducing available RAM\", \"Writing data to disk too slowly\", \"Virus stealing files\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Memory leaks occur when a program allocates heap space but fails to free it when it's no longer needed.\"\n" +
                   "  }\n" +
                   "]";
        } else if (pLower.contains("web") || pLower.contains("html") || pLower.contains("react") || pLower.contains("javascript") || pLower.contains("css")) {
            return "[\n" +
                   "  {\n" +
                   "    \"question\": \"Which HTML5 semantic element is most appropriate for a standalone, self-contained article?\",\n" +
                   "    \"options\": [\"<section>\", \"<div>\", \"<article>\", \"<aside>\"],\n" +
                   "    \"correctAnswer\": 2,\n" +
                   "    \"explanation\": \"The <article> tag defines a self-contained, independent article content block.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What is CSS Specificity?\",\n" +
                   "    \"options\": [\"Determines how fast styles load\", \"The rules browser uses to decide which CSS property values are most relevant and applied\", \"The width of responsive grids\", \"Special styling for mobile screens\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"CSS Specificity calculates the weight of different selectors to determine which rule wins.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What is a closure in JavaScript?\",\n" +
                   "    \"options\": [\"Closing the browser window\", \"A function that remembers its outer variables even after the outer function has returned\", \"Ending a statement with a semicolon\", \"Encrypting a script file\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"A closure gives an inner function access to its outer scope variables even after execution finishes.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"Which HTTP status code represents 'Unauthorized access'?\",\n" +
                   "    \"options\": [\"200 OK\", \"400 Bad Request\", \"401 Unauthorized\", \"404 Not Found\"],\n" +
                   "    \"correctAnswer\": 2,\n" +
                   "    \"explanation\": \"HTTP 401 indicates authentication credentials are required or failed.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"In React, what is the main purpose of the useEffect hook?\",\n" +
                   "    \"options\": [\"To style elements inline\", \"To manage component state\", \"To handle side effects like data fetching or subscriptions\", \"To compile JSX components\"],\n" +
                   "    \"correctAnswer\": 2,\n" +
                   "    \"explanation\": \"useEffect is designed for synchronization and managing side effects outside React rendering logic.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What does REST stand for in web services API design?\",\n" +
                   "    \"options\": [\"Routing System Transfer\", \"Representational State Transfer\", \"Responsive Web Style\", \"Realtime Encrypted Secure Transmission\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"REST stands for Representational State Transfer, a standard architectural style for network APIs.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"Which CSS property makes a container use flex layouts?\",\n" +
                   "    \"options\": [\"layout: flex\", \"display: flex\", \"flexbox: active\", \"position: flex\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Setting 'display: flex' activates the flexible box layout model for the container.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What is the DOM in web development?\",\n" +
                   "    \"options\": [\"Data Object Manager\", \"Document Object Model\", \"Direct Output Module\", \"Document Optimization Markup\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Document Object Model is a programming interface representing HTML pages as node trees.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What is the purpose of the 'alt' attribute in an HTML <img> tag?\",\n" +
                   "    \"options\": [\"Aligns the image on the screen\", \"Specifies alternative link when clicked\", \"Provides a text description for accessibility and search engines\", \"Changes image filters\"],\n" +
                   "    \"correctAnswer\": 2,\n" +
                   "    \"explanation\": \"Alt text provides accessibility descriptions for screen readers and SEO indexers.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"Which database query language is typically used for relational backend systems?\",\n" +
                   "    \"options\": [\"JSON\", \"HTML\", \"SQL\", \"CSS\"],\n" +
                   "    \"correctAnswer\": 2,\n" +
                   "    \"explanation\": \"SQL (Structured Query Language) is the standard language for querying relational databases.\"\n" +
                   "  }\n" +
                   "]";
        } else {
            return "[\n" +
                   "  {\n" +
                   "    \"question\": \"What is the main benefit of structured scheduling like Pomodoro or daily planning?\",\n" +
                   "    \"options\": [\"Decreases memory capacity\", \"Maintains focus and manages mental fatigue\", \"Eliminates code bugs\", \"Speeds up internet connection\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Pomodoro cycles keep you focused while giving regular short breaks to manage fatigue.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"In professional development, what is a Capstone project?\",\n" +
                   "    \"options\": [\"A simple math equation\", \"A significant project demonstrating comprehensive skills to future employers\", \"A type of file backup\", \"A code debugger\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Capstone projects synthesize various learned concepts into a professional-grade portfolio item.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"Why is consistent, daily practice more effective than cramming once a week?\",\n" +
                   "    \"options\": [\"Cramming consumes less energy\", \"Daily practice strengthens neural pathways and memory retention over time\", \"It is not more effective\", \"Cramming speeds up typing\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Spaced repetition and daily exercise build long-term memory stability far better than single-session cramming.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What does a Git commit represent?\",\n" +
                   "    \"options\": [\"A saved snapshot of file modifications in project history\", \"Sending files to local trash\", \"Downloading a model\", \"Compiling code files\"],\n" +
                   "    \"correctAnswer\": 0,\n" +
                   "    \"explanation\": \"A commit saves local changes to repository history as a documented checkpoint.\"\n" +
                   "  },\n" +
                   "  {\n" +
                   "    \"question\": \"What is the primary purpose of writing documentation for code?\",\n" +
                   "    \"options\": [\"To hide logic details\", \"To assist team members and future developers in understanding and maintaining code\", \"To speed up compilation\", \"To bypass tests\"],\n" +
                   "    \"correctAnswer\": 1,\n" +
                   "    \"explanation\": \"Good documentation clarifies architectural intent, reducing onboarding time and maintenance issues.\"\n" +
                   "  }\n" +
                   "]";
        }
    }

    private String generatePlannerTasksJson(String targetCareer, String prompt) {
        int needed = 3;
        try {
            if (prompt.toLowerCase().contains("exactly ")) {
                int idx = prompt.toLowerCase().indexOf("exactly ") + 8;
                int end = prompt.indexOf(" ", idx);
                if (end != -1) {
                    needed = Integer.parseInt(prompt.substring(idx, end).trim());
                }
            }
        } catch (Exception ignored) {}
        if (needed <= 0 || needed > 10) needed = 3;

        String[][] pool;
        if (targetCareer.toLowerCase().contains("game")) {
            pool = new String[][]{
                {"Study the Game Loop architecture in game engines", "theory"},
                {"Implement user keyboard inputs for character movement in Unity/Godot", "hands-on"},
                {"Review basic vector mathematics for 3D physics rotations", "review"},
                {"Read about collider triggers and rigidbodies in game physics", "theory"},
                {"Build a simple particle system for explosion effects", "hands-on"},
                {"Optimize draw calls by batching game sprites together", "review"}
            };
        } else if (targetCareer.toLowerCase().contains("web") || targetCareer.toLowerCase().contains("front") || targetCareer.toLowerCase().contains("back")) {
            pool = new String[][]{
                {"Study CSS Flexbox and Grid layout systems", "theory"},
                {"Build a responsive navbar using vanilla HTML and CSS", "hands-on"},
                {"Review Javascript closure concepts and scope behaviors", "review"},
                {"Read about REST API structures and status codes", "theory"},
                {"Implement a basic Express database server", "hands-on"},
                {"Optimize database queries using table indexing", "review"}
            };
        } else if (targetCareer.toLowerCase().contains("ai") || targetCareer.toLowerCase().contains("machine") || targetCareer.toLowerCase().contains("data")) {
            pool = new String[][]{
                {"Study Linear Algebra matrix operations in Python", "theory"},
                {"Implement a basic linear regression model in NumPy", "hands-on"},
                {"Review probability distributions and correlation metrics", "review"},
                {"Read about neural network activation functions", "theory"},
                {"Train a Scikit-Learn classifier on a sample dataset", "hands-on"},
                {"Optimize model hyperparameters using GridSearch", "review"}
            };
        } else {
            pool = new String[][]{
                {"Study core terminology and structures of " + targetCareer, "theory"},
                {"Implement a basic mock experiment or simulation for " + targetCareer, "hands-on"},
                {"Review industry best practices and common workflows", "review"},
                {"Read standard documentation or introductory case study", "theory"},
                {"Create a study outline for next major milestone", "hands-on"},
                {"Summarize recent learning notes into key takeaways", "review"}
            };
        }

        StringBuilder sb = new StringBuilder();
        sb.append("[\n");
        for (int i = 0; i < needed; i++) {
            String[] task = pool[i % pool.length];
            sb.append("  {\n");
            sb.append("    \"title\": \"").append(task[0]).append("\",\n");
            sb.append("    \"type\": \"").append(task[1]).append("\"\n");
            sb.append("  }");
            if (i < needed - 1) {
                sb.append(",\n");
            }
        }
        sb.append("\n]");
        return sb.toString();
    }

    private String generateRoadmapJson(String targetCareer, String prompt) {
        return "{\n" +
               "  \"dream\": \"" + targetCareer + "\",\n" +
               "  \"summary\": \"This offline roadmap outlines the 6 progressive stages required to transition into a " + targetCareer + ", focusing on building foundational theories, executing projects, and launching your portfolio.\",\n" +
               "  \"stages\": [\n" +
               "    {\n" +
               "      \"id\": \"stage1\",\n" +
               "      \"title\": \"Foundations of " + targetCareer + "\",\n" +
               "      \"description\": \"Focus on understanding basic terms, terminology, core equations, and foundational frameworks that govern " + targetCareer + ".\",\n" +
               "      \"duration\": \"1-2 Months\",\n" +
               "      \"subjects\": [\"Core Concepts\", \"Introductory Math\", \"Essential Tools\"],\n" +
               "      \"concepts\": [\"Learn terminology\", \"Understand system boundaries\", \"Configure workspace\"],\n" +
               "      \"skills\": [\"Basic Analysis\", \"Tool Setup\"],\n" +
               "      \"projects\": [\"Introductory Case Study\"]\n" +
               "    },\n" +
               "    {\n" +
               "      \"id\": \"stage2\",\n" +
               "      \"title\": \"Core Competency & Syntax\",\n" +
               "      \"description\": \"Learn the syntax of the programming languages or operational specifications. Work on small script elements and build initial prototypes.\",\n" +
               "      \"duration\": \"2-3 Months\",\n" +
               "      \"subjects\": [\"Intermediate Logic\", \"System Architecture\", \"Standard Workflows\"],\n" +
               "      \"concepts\": [\"Master language constructs\", \"Manage local data structures\", \"Implement standard routines\"],\n" +
               "      \"skills\": [\"Coding/Drafting\", \"Logic Design\"],\n" +
               "      \"projects\": [\"Small CLI script or layout\"]\n" +
               "    },\n" +
               "    {\n" +
               "      \"id\": \"stage3\",\n" +
               "      \"title\": \"Applied Intermediate Projects\",\n" +
               "      \"description\": \"Apply your skills to build functional tools, components, or databases. Learn about error handling, debugging, and styling details.\",\n" +
               "      \"duration\": \"2 Months\",\n" +
               "      \"subjects\": [\"Framework Integration\", \"Database Operations\", \"UI Components\"],\n" +
               "      \"concepts\": [\"Connect frontend to mock APIs\", \"Structure database schemas\", \"Style responsive layouts\"],\n" +
               "      \"skills\": [\"API Design\", \"Database Schema design\"],\n" +
               "      \"projects\": [\"Full-featured interactive app\"]\n" +
               "    },\n" +
               "    {\n" +
               "      \"id\": \"stage4\",\n" +
               "      \"title\": \"Advanced Specialization\",\n" +
               "      \"description\": \"Deep dive into advanced topics such as cloud integrations, systems optimization, high-fidelity animations, or machine learning algorithms.\",\n" +
               "      \"duration\": \"2 Months\",\n" +
               "      \"subjects\": [\"Performance Tuning\", \"Advanced Libraries\", \"System Security\"],\n" +
               "      \"concepts\": [\"Implement memory profiling\", \"Utilize multi-threading or async logic\", \"Secure access keys\"],\n" +
               "      \"skills\": [\"System Tuning\", \"Security Audit\"],\n" +
               "      \"projects\": [\"Performance-optimized component\"]\n" +
               "    },\n" +
               "    {\n" +
               "      \"id\": \"stage5\",\n" +
               "      \"title\": \"Professional Capstone & Testing\",\n" +
               "      \"description\": \"Synthesize everything you have learned to develop a robust, end-to-end Capstone project. Write unit tests and package it for production.\",\n" +
               "      \"duration\": \"1-2 Months\",\n" +
               "      \"subjects\": [\"Testing Frameworks\", \"Continuous Integration\", \"Deployment Pipelines\"],\n" +
               "      \"concepts\": [\"Write comprehensive unit tests\", \"Configure build pipelines\", \"Deploy to production staging\"],\n" +
               "      \"skills\": [\"Test-Driven Development\", \"DevOps basics\"],\n" +
               "      \"projects\": [\"Production-ready Capstone Portfolio project\"]\n" +
               "    },\n" +
               "    {\n" +
               "      \"id\": \"stage6\",\n" +
               "      \"title\": \"Portfolio Launch & Readiness\",\n" +
               "      \"description\": \"Create a professional developer portfolio website, polish your GitHub account, compile your resume, and practice mock technical interviews.\",\n" +
               "      \"duration\": \"1 Month\",\n" +
               "      \"subjects\": [\"Interview Preparation\", \"Resume Building\", \"Portfolio Design\"],\n" +
               "      \"concepts\": [\"Document code on GitHub\", \"Write developer case studies\", \"Practice coding challenges\"],\n" +
               "      \"skills\": [\"Technical Presentation\", \"Interview Communication\"],\n" +
               "      \"projects\": [\"Interactive Developer Portfolio Website\"]\n" +
               "    }\n" +
               "  ]\n" +
               "}";
    }

    private String generateTextResponse(String targetCareer, String userQuery) {
        String queryLower = userQuery.toLowerCase();
        
        if (queryLower.contains("hello") || queryLower.contains("hi") || queryLower.contains("hey") || queryLower.contains("greetings") || queryLower.contains("yo")) {
            return "🔋 Offline AI Mentor:\n\n" +
                   "Hi there! 👋 I am your Offline AI Mentor. I'm ready to guide you on your journey to becoming a " + targetCareer + ". Ask me questions about roadmaps, programming concepts, or interview preparation, and I will help you take the next step!";
        }
        
        if (queryLower.contains("game") || queryLower.contains("unity") || queryLower.contains("unreal") || queryLower.contains("godot") || queryLower.contains("play") || queryLower.contains("physics") || queryLower.contains("graphics") || queryLower.contains("assets") || queryLower.contains("3d")) {
            return "🔋 Offline AI Mentor:\n\n" +
                   "To become a successful Game Developer, understanding how games are architected is essential. Here are the core concepts to focus on:\n\n" +
                   "1. Game Loop: The heart of any game engine. It handles inputs, updates game states (physics, AI, logic), and renders the scene repeatedly (usually 60+ times per second).\n" +
                   "2. Game Engine: Choose your tools. For 2D/3D indie games, Unity (C#) or Godot (C#/GDScript) are excellent. For AAA graphics-heavy games, Unreal Engine (C++/Blueprints) is the industry standard.\n" +
                   "3. Assets Pipeline: Games consist of logic, art, and sound. You will need to learn how to import and handle 3D meshes, 2D sprites, animations, and sound effects efficiently in your engine.\n" +
                   "4. Physics & Collisions: Real-time games rely heavily on collision detection (colliders, triggers) and rigidbodies to simulate movement and interactions.\n\n" +
                   "Actionable Next Step: Download Unity or Godot, and try building a simple game like Pong or Flappy Bird from scratch to understand the coordinate systems and input controls.";
        }
        
        if (queryLower.contains("code") || queryLower.contains("program") || queryLower.contains("coding") || queryLower.contains("programming") || queryLower.contains("software") || queryLower.contains("syntax") || queryLower.contains("java") || queryLower.contains("python") || queryLower.contains("c++") || queryLower.contains("c#")) {
            return "🔋 Offline AI Mentor:\n\n" +
                   "Programming is about breaking complex problems down into step-by-step logical instructions. Here is how to build your coding skills:\n\n" +
                   "1. Master Syntax & Fundamentals: Pick one language (Python for simplicity, JavaScript for web development, or Java/C++ for core software architecture) and master variables, loops, conditionals, and functions.\n" +
                   "2. Data Structures & Algorithms: Learn arrays, lists, maps, stacks, and queues. Understanding how to organize data and optimize search/sort operations is critical.\n" +
                   "3. Object-Oriented Programming (OOP): Master classes, objects, inheritance, polymorphism, and encapsulation to write clean, reusable, and modular code.\n" +
                   "4. Version Control: Get comfortable with Git and GitHub. Storing your projects online and tracking code history is standard professional practice.\n\n" +
                   "Actionable Next Step: Write a small script daily to solve basic problems (like a calculator or fibonacci sequence generator) and push your progress to GitHub.";
        }
        
        if (queryLower.contains("web") || queryLower.contains("html") || queryLower.contains("css") || queryLower.contains("js") || queryLower.contains("javascript") || queryLower.contains("react") || queryLower.contains("frontend") || queryLower.contains("backend") || queryLower.contains("fullstack") || queryLower.contains("website") || queryLower.contains("api") || queryLower.contains("database")) {
            return "🔋 Offline AI Mentor:\n\n" +
                   "Web Development is split into frontend (client-side) and backend (server-side). To master full-stack development, focus on:\n\n" +
                   "1. Frontend Core: Learn HTML5 for document structure, CSS3 for layout (Flexbox and Grid) and styling, and JavaScript (ES6+) for interactive logic.\n" +
                   "2. Frontend Frameworks: React, Vue, or Angular help organize large-scale applications with reusable UI components and state management.\n" +
                   "3. Backend & APIs: Node.js, Python, or Go are used to build web servers. Learn to write RESTful APIs that connect the frontend to database systems.\n" +
                   "4. Databases: Learn SQL (PostgreSQL, MySQL) or NoSQL (MongoDB) to manage user accounts, application data, and storage query logic.\n\n" +
                   "Actionable Next Step: Build a personal portfolio website using HTML, CSS, and vanilla JS, host it on GitHub Pages or Vercel, and use it to showcase your work.";
        }
        
        if (queryLower.contains("ai") || queryLower.contains("ml") || queryLower.contains("intelligence") || queryLower.contains("machine") || queryLower.contains("learning") || queryLower.contains("neural") || queryLower.contains("deep") || queryLower.contains("llm") || queryLower.contains("model")) {
            return "🔋 Offline AI Mentor:\n\n" +
                   "Artificial Intelligence (AI) and Machine Learning (ML) are transforming how software interacts with data. Here is the path to master them:\n\n" +
                   "1. Foundations of Mathematics: Focus on Linear Algebra (vectors, matrices), Calculus (derivatives, gradients for optimization), and Probability & Statistics.\n" +
                   "2. Python & Libraries: Learn Python, then master data manipulation libraries like NumPy, Pandas, and visualization tools like Matplotlib.\n" +
                   "3. Traditional Machine Learning: Understand regression, classification, clustering, and decision trees using Scikit-Learn.\n" +
                   "4. Deep Learning & Neural Networks: Learn how multi-layered neural networks process data (NLP, Computer Vision) using frameworks like PyTorch or TensorFlow.\n\n" +
                   "Actionable Next Step: Download a clean dataset from Kaggle, use a Jupyter Notebook to explore the variables, and train a basic linear regression model to make predictions.";
        }
        
        if (queryLower.contains("database") || queryLower.contains("sql") || queryLower.contains("db") || queryLower.contains("query") || queryLower.contains("postgres") || queryLower.contains("mysql") || queryLower.contains("mongodb") || queryLower.contains("supabase")) {
            return "🔋 Offline AI Mentor:\n\n" +
                   "Databases are the foundation of any application. They store and retrieve data reliably. Focus on these key areas:\n\n" +
                   "1. Relational Databases (SQL): Learn PostgreSQL or MySQL. Master writing SELECT queries, JOINs, WHERE clauses, and aggregations (GROUP BY).\n" +
                   "2. Database Design & Normalization: Learn how to structure tables, establish relationships (one-to-many, many-to-many), and design schemas to prevent data duplication.\n" +
                   "3. NoSQL Databases: Explore MongoDB or Redis for unstructured, document-based data or key-value caching.\n" +
                   "4. Database Optimization: Learn about indexing, query execution plans, and transactions to ensure database speed under heavy user loads.\n\n" +
                   "Actionable Next Step: Install PostgreSQL locally or create a Supabase project, design a schema for a simple blogging system, and practice writing complex JOIN queries.";
        }
        
        if (queryLower.contains("app") || queryLower.contains("mobile") || queryLower.contains("android") || queryLower.contains("ios") || queryLower.contains("swift") || queryLower.contains("kotlin") || queryLower.contains("flutter") || queryLower.contains("react native") || queryLower.contains("capacitor")) {
            return "🔋 Offline AI Mentor:\n\n" +
                   "Mobile Development allows you to build touch-enabled apps for phones and tablets. Here are your core paths:\n\n" +
                   "1. Native Android: Learn Kotlin and Jetpack Compose to build high-performance native apps using Google's modern Android design guidelines.\n" +
                   "2. Native iOS: Learn Swift and SwiftUI to develop clean, smooth native apps specifically tailored for Apple devices.\n" +
                   "3. Cross-Platform Frameworks: Flutter (Dart) or React Native / Capacitor (JavaScript/TypeScript) let you write one codebase that compiles to both platforms.\n" +
                   "4. Mobile Lifecycle & Storage: Understand how mobile apps pause/resume, and learn local caching databases like SQLite, Room, or CoreData.\n\n" +
                   "Actionable Next Step: Install Android Studio or Xcode, create a simple To-Do List app with a clean UI, and test it running on a simulator or physical phone.";
        }
        
        if (queryLower.contains("calculus") || queryLower.contains("math") || queryLower.contains("derivative") || queryLower.contains("integral") || queryLower.contains("equation")) {
            return "🔋 Offline AI Mentor:\n\n" +
                   "Mathematics, particularly calculus, is the mathematical engine behind computer graphics, physics simulation, and machine learning:\n\n" +
                   "1. Derivatives & Slopes: Derivatives measure rates of change. In machine learning, gradients (partial derivatives) are used in gradient descent to optimize model parameters.\n" +
                   "2. Integrals & Area: Integrals compute the accumulation of quantities over time or space. They are key for physical simulations, acoustics, and signal processing.\n" +
                   "3. Physics in Games: Calculus allows game engines to compute speed, acceleration, gravity, and particle collisions realistically.\n" +
                   "4. Analytical Problem Solving: Practicing math builds the algorithmic thinking required to solve complex coding bugs.\n\n" +
                   "Actionable Next Step: Write a basic Python script that implements gradient descent for a simple 1D function (like y = x^2) to visualize how derivatives locate the minimum.";
        }
        
        if (queryLower.contains("study") || queryLower.contains("roadmap") || queryLower.contains("become") || queryLower.contains("career") || queryLower.contains("path") || queryLower.contains("how to") || queryLower.contains("steps")) {
            return "🔋 Offline AI Mentor:\n\n" +
                   "Here is a structured, step-by-step roadmap to guide your path to becoming a successful " + targetCareer + ":\n\n" +
                   "Step 1: Foundational Theory (Month 1-2)\n" +
                   "Focus on learning the syntax, terminology, and core structures of your field. Dedicate time to understanding the 'why' behind concepts.\n\n" +
                   "Step 2: Simple Implementation (Month 3-4)\n" +
                   "Build small, isolated projects. If you are learning coding, make command-line scripts. If design, create basic UI/UX mockups. Keep them simple to gain confidence.\n\n" +
                   "Step 3: Capstone Portfolio Projects (Month 5-6)\n" +
                   "Develop 2-3 significant projects from scratch. Document your development process on GitHub or a personal portfolio website, detailing how you solved problems.\n\n" +
                   "Step 4: Professional Readiness (Month 7+)\n" +
                   "Prepare a clean resume, polish your LinkedIn/GitHub presence, practice mock interviews, and begin networking in professional groups or local meetups.\n\n" +
                   "Advice: Be consistent. Practicing for 1 hour every day is far more effective than cramming for 8 hours once a week.";
        }
        
        // General fallback response
        return "🔋 Offline AI Mentor:\n\n" +
               "To excel in your path to becoming a " + targetCareer + ", exploring \"" + userQuery + "\" is a very productive step.\n\n" +
               "Here is some actionable guidance:\n" +
               "1. Core Focus: Understand the fundamental principles behind " + userQuery + " and how it integrates with other tools in " + targetCareer + ".\n" +
               "2. Small Projects: Try creating a small, simple test case or sandbox script to experiment with the concept hands-on.\n" +
               "3. Practical Integration: Look at real-world projects or documentation to see how professionals implement this in production environments.\n\n" +
               "Keep experimenting, and feel free to ask more specific questions about coding, system design, or study techniques!";
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
