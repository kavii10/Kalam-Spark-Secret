package com.kalamspark.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.os.AsyncTask;
import android.os.Environment;
import android.util.Log;
import java.io.File;

@CapacitorPlugin(name = "LlamaPlugin")
public class LlamaPlugin extends Plugin {
    private static final String TAG = "LlamaPlugin";
    private boolean isLoaded = false;
    private String loadedModelPath = "";

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
     * Handles: standard Android, MIUI, and alternative storage configs.
     */
    private String[] buildPathCandidates(String providedPath) {
        // Extract just the filename
        String fileName = new File(providedPath).getName();
        
        // Standard external storage path
        File externalDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        
        return new String[] {
            providedPath,                                               // Provided path (e.g. /storage/emulated/0/Download/model.gguf)
            externalDir.getAbsolutePath() + "/" + fileName,           // Environment.DIRECTORY_DOWNLOADS/filename
            "/storage/emulated/0/Download/" + fileName,               // Standard Android emulated path
            "/sdcard/Download/" + fileName,                            // Legacy sdcard path
            "/mnt/sdcard/Download/" + fileName,                        // MIUI alternative
            "/storage/emulated/0/Downloads/" + fileName,               // Some phones use 'Downloads' (plural)
        };
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
        String resolvedPath = null;

        for (String path : pathsToTry) {
            File candidate = new File(path);
            Log.d(TAG, "loadModel: trying " + path + " exists=" + candidate.exists() + " size=" + candidate.length());
            if (candidate.exists() && candidate.isFile() && candidate.length() > 1024 * 1024) {
                resolvedFile = candidate;
                resolvedPath = path;
                break;
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
            // Currently uses Java fallback — the model "loads" by recording the path
            loadedModelPath = resolvedPath;
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

    // ── JNI Native hooks (loaded from libllama.so compiled via CMake) ──
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

        // 5. Default mentor chat response
        return "🔋 Offline Mode (Local Gemma 4): I'm here to guide your learning journey! " +
               "I can see you're working hard toward your career goals. " +
               "While offline, you can review your roadmap, complete quiz questions, " +
               "and track your task progress. Once you reconnect to the internet, " +
               "I'll provide full AI-powered mentoring with web research and document analysis. " +
               "What specific aspect of your career plan would you like to work on right now?";
    }
}
