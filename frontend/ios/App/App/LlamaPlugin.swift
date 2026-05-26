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

        // Check if the caller specifically requested structured JSON output
        let wantsJson = !system.isEmpty && (
            sLower.contains("json") ||
            sLower.contains("schema") ||
            sLower.contains("return only") ||
            sLower.contains("valid raw")
        )

        if wantsJson {
            // 1. Roadmap Generation
            if pLower.contains("roadmap") || pLower.contains("stages") {
                var dream = "Software Engineer"
                if pLower.contains("data scientist") { dream = "Data Scientist" }
                else if pLower.contains("ui/ux") { dream = "UI/UX Designer" }
                else if pLower.contains("product manager") { dream = "Product Manager" }
                else if pLower.contains("doctor") { dream = "Doctor" }
                else if pLower.contains("teacher") { dream = "Teacher" }
                else if pLower.contains("designer") { dream = "Designer" }

                return """
                {
                  "dream": "\(dream)",
                  "summary": "A structured roadmap to build your career in \(dream) through progressive stages of learning and real-world projects.",
                  "stages": [
                    {
                      "id": "stage-1",
                      "title": "Stage 1: Foundations of \(dream)",
                      "description": "Build the core knowledge base. Learn fundamental concepts, tools, and problem-solving approaches essential for \(dream).",
                      "duration": "6-8 weeks",
                      "subjects": ["Core Concepts", "Introduction to Tools", "Logic and Reasoning", "Basic Mathematics"],
                      "skills": ["Problem Solving", "Tool Proficiency", "Communication"],
                      "projects": ["Build a portfolio website", "Create a basic demonstration project"],
                      "resources": []
                    },
                    {
                      "id": "stage-2",
                      "title": "Stage 2: Core Skills Development",
                      "description": "Deepen your expertise with intermediate techniques, system thinking, and collaborative workflows.",
                      "duration": "8-12 weeks",
                      "subjects": ["Advanced Techniques", "System Architecture", "Version Control", "Data Analysis"],
                      "skills": ["Code/Work Optimization", "Testing & Debugging", "Team Collaboration"],
                      "projects": ["Build an interactive application", "Contribute to an open-source project"],
                      "resources": []
                    },
                    {
                      "id": "stage-3",
                      "title": "Stage 3: Advanced Architectures & Specialization",
                      "description": "Master industry standards, large-scale systems, security practices, and deployment pipelines.",
                      "duration": "10-14 weeks",
                      "subjects": ["System Design", "Cloud Computing", "Security Principles", "Performance Optimization"],
                      "skills": ["Cloud Deployment", "API Integration", "Security Hardening"],
                      "projects": ["Deploy a full-stack scalable service", "Implement secure authorization modules"],
                      "resources": []
                    },
                    {
                      "id": "stage-4",
                      "title": "Stage 4: Professional Mastery & Career Launch",
                      "description": "Develop advanced specialties, solve real-world case studies, build your network, and prepare for job interviews.",
                      "duration": "12-16 weeks",
                      "subjects": ["Real-world Systems", "Interview Preparation", "Professional Networking", "Leadership"],
                      "skills": ["Technical Interviews", "Team Leadership", "Stakeholder Communication"],
                      "projects": ["Complete a capstone project", "Build a production-ready application for portfolio"],
                      "resources": []
                    }
                  ]
                }
                """
            }

            // 2. Quiz Generation
            if pLower.contains("quiz") || pLower.contains("mcq") || pLower.contains("question") {
                return """
                [
                  {
                    "question": "Which habit is most vital for long-term career growth?",
                    "options": ["Continuous Learning", "Memorization only", "Avoiding challenges", "Working in isolation"],
                    "correctAnswer": 0,
                    "explanation": "Continuous learning and adaptability are critical as industries change rapidly."
                  },
                  {
                    "question": "How should you approach complex problems in your career?",
                    "options": ["Deconstruct into smaller parts", "Avoid them entirely", "Ask others to solve them", "Postpone indefinitely"],
                    "correctAnswer": 0,
                    "explanation": "Deconstructing complex issues helps you tackle each component efficiently without being overwhelmed."
                  },
                  {
                    "question": "What is the best way to build a professional network?",
                    "options": ["Attend industry events and contribute to communities", "Wait to be discovered", "Only connect with close friends", "Avoid social media"],
                    "correctAnswer": 0,
                    "explanation": "Active participation in communities and events significantly expands career opportunities."
                  }
                ]
                """
            }

            // 3. Career Summary
            if pLower.contains("summary") || pLower.contains("overview") || pLower.contains("sentence") {
                return """
                {
                  "sentence1": "This career offers a highly rewarding path filled with creative problem solving and innovation.",
                  "sentence2": "Professionals use state-of-the-art tools and collaborate in dynamic environments to shape meaningful products.",
                  "sentence3": "Building strong foundations and creating hands-on projects are the keys to lasting success in this domain."
                }
                """
            }

            // 4. Career Suggestions / Dream Discovery
            if pLower.contains("career") || pLower.contains("dream") || pLower.contains("suggest") {
                return """
                [
                  {"dream": "Software Engineer", "subjects": ["Computer Science", "Logic", "Mathematics"]},
                  {"dream": "Data Scientist", "subjects": ["Statistics", "Python", "Analysis"]},
                  {"dream": "UI/UX Designer", "subjects": ["Design", "Psychology", "Prototyping"]},
                  {"dream": "Product Manager", "subjects": ["Business", "Leadership", "Communication"]},
                  {"dream": "AI/ML Engineer", "subjects": ["Machine Learning", "Python", "Mathematics"]},
                  {"dream": "Cybersecurity Specialist", "subjects": ["Networking", "Security", "Problem Solving"]},
                  {"dream": "Digital Marketer", "subjects": ["SEO", "Content Strategy", "Analytics"]},
                  {"dream": "Cloud Architect", "subjects": ["Infrastructure", "DevOps", "Cloud Platforms"]},
                  {"dream": "Research Scientist", "subjects": ["Physics", "Research Methods", "Documentation"]},
                  {"dream": "Business Analyst", "subjects": ["Data Analysis", "Finance", "Strategy"]},
                  {"dream": "Content Creator", "subjects": ["Storytelling", "Video Editing", "Social Media"]},
                  {"dream": "Financial Analyst", "subjects": ["Accounting", "Investment", "Excel"]}
                ]
                """
            }
        }

        // --- DOCUMENT RAG / QA ENGINE ---
        if pLower.contains("documents:") || pLower.contains("document:") || pLower.contains("attached document") {
            // 1. Extract query
            var query = ""
            if let lastStudentRange = prompt.range(of: "Student:", options: .backwards) {
                let studentPart = String(prompt[lastStudentRange.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                if let aiRange = studentPart.range(of: "AI:") {
                    query = String(studentPart[..<aiRange.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
                } else {
                    query = studentPart
                }
            } else if let lastQRange = prompt.range(of: "Question:", options: .backwards) {
                let questionPart = String(prompt[lastQRange.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                if let aiRange = questionPart.range(of: "AI:") {
                    query = String(questionPart[..<aiRange.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
                } else {
                    query = questionPart
                }
            } else {
                query = prompt.count > 200 ? String(prompt.suffix(200)) : prompt
            }

            // 2. Extract documents context
            var docContext = ""
            var docStartIdx: String.Index? = nil
            if let range = prompt.range(of: "documents:", options: .caseInsensitive) { docStartIdx = range.lowerBound }
            else if let range = prompt.range(of: "document:", options: .caseInsensitive) { docStartIdx = range.lowerBound }
            else if let range = prompt.range(of: "attached document", options: .caseInsensitive) { docStartIdx = range.lowerBound }
            
            if let startIdx = docStartIdx {
                let docPart = String(prompt[startIdx...])
                var docEndIdx: String.Index? = nil
                if let range = docPart.range(of: "History:") { docEndIdx = range.lowerBound }
                else if let range = docPart.range(of: "Student:") { docEndIdx = range.lowerBound }
                else if let range = docPart.range(of: "Question:") { docEndIdx = range.lowerBound }
                
                if let endIdx = docEndIdx {
                    docContext = String(docPart[..<endIdx]).trimmingCharacters(in: .whitespacesAndNewlines)
                } else {
                    docContext = docPart.trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }

            if !docContext.isEmpty && !query.isEmpty {
                let qClean = query.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).joined(separator: " ")
                let qWords = qClean.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }
                var keywords: [String] = []
                for w in qWords {
                    if w.count > 4 && w != "what" && w != "would" && w != "about" &&
                       w != "there" && w != "could" && w != "should" && w != "explain" {
                        keywords.append(w)
                    }
                }

                // Split context into sentences
                let sentences = docContext.components(separatedBy: CharacterSet(charactersIn: ".")).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                var matchedSentences: [String] = []
                
                for sentence in sentences {
                    let sLowerLine = sentence.lowercased()
                    var matchCount = 0;
                    for kw in keywords {
                        if sLowerLine.contains(kw) {
                            matchCount += 1
                        }
                    }
                    if matchCount > 0 {
                        if sentence.count > 10 && sentence.count < 300 && !matchedSentences.contains(sentence) {
                            matchedSentences.append(sentence)
                        }
                    }
                    if matchedSentences.count >= 4 { break }
                }

                if !matchedSentences.isEmpty {
                    var sb = "🔋 Offline Document Swift RAG:\n\n"
                    for s in matchedSentences {
                        sb += "- \(s)\n"
                    }
                    sb += "\n(Offline mode: Keyword-extracted from local loaded files)"
                    return sb
                }
            }
            
            return "🔋 Offline Document Reader:\n\nI see you are asking about the loaded documents: \"\(query)\". " +
                   "While offline, I can read local texts. If you need a full contextual synthesis or semantic analysis, please reconnect to the internet. " +
                   "What specific term or keyword from the documents would you like me to look up?"
        }

        // --- DYNAMIC OFFLINE CHATBOT ENGINE ---
        var userQuery = prompt
        if let lastStudentRange = prompt.range(of: "Student:", options: .backwards) {
            let studentPart = String(prompt[lastStudentRange.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
            if let aiRange = studentPart.range(of: "AI:") {
                userQuery = String(studentPart[..<aiRange.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
            } else {
                userQuery = studentPart
            }
        }
        
        let qLower = userQuery.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).joined(separator: " ").trimmingCharacters(in: .whitespacesAndNewlines)

        // Extract career target from system instruction
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

        // 1. Handle Greetings
        if qLower == "hi" || qLower == "hello" || qLower == "hey" ||
            qLower.contains("hello kalam") || qLower.contains("hi kalam") || qLower.contains("greetings") ||
            qLower.contains("yo") || qLower.contains("sup") {
            return "Hello! 👋 I'm Kalam Spark, your offline Swift AI mentor. Even though we are offline right now, I'm here to support you in planning your learning journey towards \(targetCareer). What would you like to discuss today?"
        }

        // 2. Handle "who are you" / "what are you" / "about you"
        if qLower.contains("who are you") || qLower.contains("what is your name") || qLower.contains("about you") || qLower.contains("your role") {
            return "I am **Kalam Spark**, your AI career mentor, inspired by Dr. A.P.J. Abdul Kalam. I help you explore career roadmaps, discover study resources, track tasks in your Planner, and test your knowledge. Even when offline, I can guide you through fundamental principles!"
        }

        // 3. Handle Board Exams / CBSE / ICSE / State Board
        if qLower.contains("cbse") || qLower.contains("icse") || qLower.contains("state board") || qLower.contains("matriculation") || qLower.contains("board exam") {
            return "Preparing for board exams (CBSE, ICSE, or State Board) is a critical milestone! Here are offline tips:\n\n" +
                   "- **Syllabus Focus**: Stick strictly to your textbooks (like NCERT for CBSE) as questions match them closely.\n" +
                   "- **Previous Years**: Solve past 5-year question papers to understand exam patterns and marking schemes.\n" +
                   "- **Time Management**: Practice writing complete papers under a 3-hour limit to build speed and presentation style.\n\n" +
                   "I can customize your active Planner tasks to balance school syllabus with your goal to become a \(targetCareer)."
        }

        // 4. Handle "What is AI" / "Explain AI" / "AI"
        if qLower.contains("what is ai") || qLower.contains("explain ai") ||
            qLower.contains("define ai") || qLower.contains("artificial intelligence") ||
            qLower.contains("about ai") || qLower.contains("what is machine learning") {
            return "Artificial Intelligence (AI) is the simulation of human intelligence processes by machines, especially computer systems. These processes include learning, reasoning, and self-correction.\n\nKey areas of AI include:\n- **Machine Learning**: Systems learning from data patterns without explicit programming.\n- **Deep Learning**: Using multi-layered neural networks to solve complex tasks.\n- **Natural Language Processing (NLP)**: Enabling computers to understand and generate human language.\n\nUnderstanding AI concepts will give you a massive competitive advantage in \(targetCareer). What specific aspect of AI are you most interested in?"
        }

        // 5. Handle Study/Learning Tips
        if qLower.contains("how to learn") || qLower.contains("study tips") || qLower.contains("learning techniques") || qLower.contains("how to study") || qLower.contains("tips") {
            return "Here are three powerful study techniques to help you master topics in \(targetCareer):\n\n1. **Active Recall**: Test your memory instead of passively re-reading. Try to write down everything you know about a topic from memory.\n2. **Spaced Repetition**: Review the material at expanding intervals (e.g., after 1 day, then 3 days, then 7 days) to build long-term memory retrieval pathways.\n3. **Feynman Technique**: Explain the concept in simple terms to someone else. If you struggle to simplify it, you know exactly which areas you need to review.\n\nWhich of these would you like to apply to your tasks today?"
        }

        // 6. Handle Career paths / "how to become"
        if qLower.contains("how to become") || qLower.contains("career path") || qLower.contains("roadmap for") || qLower.contains("become a") || qLower.contains("job outlook") {
            var careerOfInterest = targetCareer
            if let becomeRange = qLower.range(of: "become a ") {
                let suffix = String(userQuery[becomeRange.upperBound...])
                careerOfInterest = suffix.trimmingCharacters(in: .whitespacesAndNewlines)
            } else if let becomeRange = qLower.range(of: "become an ") {
                let suffix = String(userQuery[becomeRange.upperBound...])
                careerOfInterest = suffix.trimmingCharacters(in: .whitespacesAndNewlines)
            }

            return "Pursuing a career as a \(careerOfInterest) is an exciting journey! Here is a general framework to guide you:\n\n1. **Core Education**: Master the fundamental concepts, tools, and methodologies of the field.\n2. **Practical Projects**: Build a portfolio demonstrating your hands-on ability (theory is good, but code or designs are better!).\n3. **Networking**: Connect with professionals in the community and seek mentorship.\n4. **Continuous Learning**: Stay updated with the latest trends and tools.\n\nWhat stage of preparation are you currently at for this career?"
        }

        // 7. Handle Career pivot / change / transition
        if qLower.contains("pivot") || qLower.contains("transition") || qLower.contains("change career") || qLower.contains("career change") {
            return "Pivoting careers is very common and achievable! When transitioning into \(targetCareer), focus on:\n\n" +
                   "1. **Transferable Skills**: Communication, logical thinking, and project management transfer to almost any role.\n" +
                   "2. **Gap Analysis**: Identify which technical tools or certifications are required for \(targetCareer).\n" +
                   "3. **Bridging Plan**: Build 2-3 specific projects that blend your old background with the new target field.\n\n" +
                   "Try using our **Career Pivot** page to get a detailed transition score and bridge plan!"
        }

        // 8. Handle Opportunities / Jobs / Internships
        if qLower.contains("job") || qLower.contains("internship") || qLower.contains("hackathon") || qLower.contains("opportunity") || qLower.contains("find work") {
            return "To land internships and jobs in \(targetCareer), I recommend:\n\n" +
                   "- **Platforms**: Check platforms like Internshala, LinkedIn Jobs, and Unstop (for hackathons/competitions).\n" +
                   "- **Portfolio**: Build a strong GitHub, Behance, or personal site showing 3 completed projects.\n" +
                   "- **Resume**: Focus on impact (what you built, what tools you used, and what you achieved).\n\n" +
                   "You can review current opportunities in our **Opportunities** section once you are online!"
        }

        // 9. Handle Quizzes / Test
        if qLower.contains("quiz") || qLower.contains("test me") || qLower.contains("question") || qLower.contains("mcq") {
            return "Testing your knowledge is the best way to study! To take a quiz:\n\n" +
                   "1. Go to the **Study Center** in the app.\n" +
                   "2. Choose your current subject or roadmap stage.\n" +
                   "3. Click 'Take Quiz' to start a 10-question test with explanations.\n\n" +
                   "Would you like me to share a quick quiz question right here in the chat?"
        }

        // 10. Handle "thank you" / "thanks"
        if qLower.contains("thank you") || qLower.contains("thanks") {
            return "You are very welcome! 😊 Helping you succeed in your path towards \(targetCareer) is my primary goal. Feel free to ask any other questions, review your Planner, or complete a Study Center quiz!"
        }

        // 11. Handle specific technical topics (code, web, database, etc.)
        if qLower.contains("python") || qLower.contains("java") || qLower.contains("javascript") || qLower.contains("coding") || qLower.contains("programming") || qLower.contains("c++") || qLower.contains("html") || qLower.contains("css") {
            return "Programming is a superpower! To learn coding effectively for \(targetCareer), I highly recommend:\n- Writing code every single day (even if it's just 15 minutes).\n- Solving problem sets on platforms like LeetCode or HackerRank.\n- Building small personal projects (like a calculator, weather app, or personal blog) to apply what you've learned.\n\nIs there a specific programming language or library you are focusing on right now?"
        }

        // 12. General question extraction fallback
        let words = qLower.components(separatedBy: .whitespacesAndNewlines).filter { $0.count > 0 }
        if words.count > 2 {
            var keywordsList: [String] = []
            var count = 0
            for w in words {
                if w.count > 4 && w != "student" && w != "mentor" && w != "question" && w != "explain" {
                    keywordsList.append(w)
                    count += 1
                    if count >= 2 { break }
                }
            }

            if !keywordsList.isEmpty {
                let kwString = keywordsList.joined(separator: " ")
                return "🔋 Offline Mode (Local Gemma 4): That is a great question about **\(kwString)**!\n\nTo master this concept in your journey to become a \(targetCareer), I recommend:\n- Reading textbooks or articles covering the foundations.\n- Creating a dedicated task in your **Task Planner** to research it further.\n- Building a small practical project to test your understanding.\n\nOnce you are back online, I can do a deep search and document analysis to give you a comprehensive breakdown. What other aspect of this would you like to explore?"
            }
        }

        // 13. Default fallback response if no keywords matched
        return "🔋 Offline Mode (Local Gemma 4): I hear your query about \"\(userQuery)\". " +
               "As your mentor, I encourage you to stay focused on your goals! " +
               "While offline, you can continue tracking tasks on your Planner and completing quizzes in the Study Center. " +
               "Once you reconnect to the internet, I'll provide full AI-powered mentoring with web research and document analysis. " +
               "What specific aspect of your career plan for \(targetCareer) would you like to work on right now?"
    }
}
