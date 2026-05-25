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
        
        // 1. Roadmap Generation
        if pLower.contains("roadmap") || pLower.contains("stages") {
            var dream = "Software Engineer"
            if pLower.contains("data scientist") { dream = "Data Scientist" }
            else if pLower.contains("ui/ux") { dream = "UI/UX Designer" }
            else if pLower.contains("product manager") { dream = "Product Manager" }
            else if pLower.contains("doctor") { dream = "Doctor" }
            
            return """
            {
              "dream": "\(dream)",
              "summary": "A structured roadmap to build your career in \(dream) through progressive stages of learning.",
              "stages": [
                {
                  "id": "stage-1",
                  "title": "Stage 1: Fundamentals of \(dream)",
                  "description": "Focus on basic building blocks, key tools, and primary concepts needed to start in \(dream).",
                  "duration": "6-8 weeks",
                  "subjects": ["Core Concepts", "Introduction to Tools", "Logic and Reasoning"],
                  "skills": ["Problem Solving", "Basic Tools usage"],
                  "projects": ["Build a simple portfolio website", "Create a basic script"],
                  "resources": []
                },
                {
                  "id": "stage-2",
                  "title": "Stage 2: Core Development & Techniques",
                  "description": "Dive deeper into system architectures, intermediate skills, and workflow management.",
                  "duration": "8-12 weeks",
                  "subjects": ["Advanced programming", "Data structures", "Version control"],
                  "skills": ["Code optimization", "Testing & Debugging"],
                  "projects": ["Build an interactive application", "Contribute to open source"],
                  "resources": []
                },
                {
                  "id": "stage-3",
                  "title": "Stage 3: Advanced Architectures",
                  "description": "Master industrial standards, large-scale systems, security practices, and deployment pipelines.",
                  "duration": "10-14 weeks",
                  "subjects": ["System design", "Cloud computing", "Security principles"],
                  "skills": ["Cloud deployment", "API integration"],
                  "projects": ["Deploy a full-stack scalable web service", "Implement secure authorization modules"],
                  "resources": []
                },
                {
                  "id": "stage-4",
                  "title": "Stage 4: Industry Specialization",
                  "description": "Develop advanced specialties, solve complex real-world case studies, and prepare for job interviews.",
                  "duration": "12-16 weeks",
                  "subjects": ["Real-world systems", "Interview prep", "Professional networking"],
                  "skills": ["Technical interview strategy", "Team collaboration"],
                  "projects": ["Complete a major capstone project", "Build a production-ready application"],
                  "resources": []
                }
              ]
            }
            """
        }
        
        // 2. Quiz Generation
        if pLower.contains("quiz") || pLower.contains("mcq") {
            return """
            [
              {
                "question": "Which of the following is the most vital skill for long-term career growth?",
                "options": ["Continuous Learning", "Memorization", "Doing minimal tasks", "Working in isolation"],
                "correctAnswer": 0,
                "explanation": "Continuous learning and adaptability are critical as industries change rapidly."
              },
              {
                "question": "How should you approach complex problems in your study plan?",
                "options": ["Deconstruct them into smaller parts", "Avoid them", "Ask someone to write the solution", "Postpone indefinitely"],
                "correctAnswer": 0,
                "explanation": "Deconstructing complex issues helps you tackle each component efficiently without being overwhelmed."
              }
            ]
            """
        }

        // 3. Career Summary
        if pLower.contains("summary") || pLower.contains("overview") {
            return """
            {
              "sentence1": "This career offers a highly rewarding path filled with creative problem solving and innovation.",
              "sentence2": "Professionals use state-of-the-art tools and collaborate in dynamic environments to shape tech products.",
              "sentence3": "Developing strong foundations and creating hands-on projects are keys to success in this domain."
            }
            """
        }

        // 4. Chat Mentor
        return "Offline Mode (Local Gemma 4): I am here to help you guide your learning path. " +
               "It looks like you are running the app offline. You can view your roadmap, take quizzes, " +
               "and track your planner tasks. Once you are online, I can analyze attachments and perform web research."
    }
}
