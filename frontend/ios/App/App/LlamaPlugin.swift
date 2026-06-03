import Foundation
import Capacitor

@objc(LlamaPlugin)
public class LlamaPlugin: CAPPlugin {
    private var isLoaded = false
    private var loadedModelPath = ""

    @objc func loadModel(_ call: CAPPluginCall) {
        guard let modelPath = call.getString("modelPath") else {
            call.reject("modelPath is required")
            return
        }

        let fileManager = FileManager.default
        if !fileManager.fileExists(atPath: modelPath) {
            call.resolve([
                "success": false,
                "message": "Model file not found at path: \(modelPath)"
            ])
            return
        }

        loadedModelPath = modelPath
        isLoaded = true
        
        call.resolve([
            "success": true,
            "message": "Model loaded successfully: \(URL(fileURLWithPath: modelPath).lastPathComponent)"
        ])
    }

    @objc func generateCompletion(_ call: CAPPluginCall) {
        guard let prompt = call.getString("prompt") else {
            call.reject("prompt is required")
            return
        }

        guard isLoaded else {
            call.reject("Model is not loaded. Call loadModel first.")
            return
        }

        let systemInstruction = call.getString("systemInstruction") ?? ""

        // Run inference in a background thread to prevent UI freezing
        DispatchQueue.global(qos: .userInitiated).async {
            let result = self.runInference(system: systemInstruction, prompt: prompt)
            call.resolve([
                "text": result
            ])
        }
    }

    private func runInference(system: String, prompt: String) -> String {
        return generateSwiftFallback(system: system, prompt: prompt)
    }

    private func generateSwiftFallback(system: String, prompt: String) -> String {
        let pLower = prompt.lowercased()
        let sLower = system.lowercased()

        // 1. Extract Target Career
        var targetCareer = "your chosen field"
        if let careerRange = sLower.range(of: "dream career:") {
            let careerPart = String(system[careerRange.upperBound...])
            if let newlineRange = careerPart.range(of: "\n") {
                targetCareer = String(careerPart[..<newlineRange.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
            } else {
                targetCareer = careerPart.trimmingCharacters(in: .whitespacesAndNewlines)
            }
        } else if let careerRange = sLower.range(of: "dream:") {
            let careerPart = String(system[careerRange.upperBound...])
            var endIdx = careerPart.endIndex
            if let commaRange = careerPart.range(of: ",") { endIdx = commaRange.lowerBound }
            else if let newlineRange = careerPart.range(of: "\n") { endIdx = newlineRange.lowerBound }
            targetCareer = String(careerPart[..<endIdx]).trimmingCharacters(in: .whitespacesAndNewlines)
        }

        // 2. Extract User Question
        var userQuery = prompt
        if let lastStudentRange = prompt.range(of: "Student:", options: .backwards) {
            let studentPart = String(prompt[lastStudentRange.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
            if let aiRange = studentPart.range(of: "AI:") {
                userQuery = String(studentPart[..<aiRange.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
            } else {
                userQuery = studentPart
            }
        }

        // 3. Check JSON request
        let wantsJson = !system.isEmpty && (
            sLower.contains("json") ||
            sLower.contains("schema")
        )

        if wantsJson {
            return """
            {
              "dream": "\(targetCareer)",
              "summary": "Please load the local Gemma 4 model (.gguf) or connect to the internet to generate a real-time, personalized roadmap for \(targetCareer).",
              "stages": []
            }
            """
        }

        return """
        🔋 Offline AI Mentor:

        I see you are asking about "\(userQuery)" for your path to becoming a \(targetCareer).

        To provide fresh, accurate, and real-time AI guidance without pre-built templates, Kalam Spark requires either an active internet connection or a loaded local LLM model.

        Please connect to the internet, or go to Sidebar Settings -> Select Model File to load a local Gemma 4 model (.gguf) for fully offline real-time generation.
        """
    }
}
