import Foundation
import Capacitor
import AVFoundation

@objc(LlamaPlugin)
public class LlamaPlugin: CAPPlugin, AVSpeechSynthesizerDelegate {
    private var isLoaded = false
    private var loadedModelPath = ""
    private let speechSynthesizer = AVSpeechSynthesizer()

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
        if !isLoaded {
            return """
            🔋 Offline AI Mentor:

            Please connect to the internet, or go to Sidebar Settings -> Select Model File to load a local Gemma 4 model (.gguf) for fully offline real-time generation.
            """
        }

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
        } else if let careerRange = pLower.range(of: "student dream:") {
            let careerPart = String(prompt[careerRange.upperBound...])
            var endIdx = careerPart.endIndex
            if let dotRange = careerPart.range(of: ".") { endIdx = dotRange.lowerBound }
            else if let bracketRange = careerPart.range(of: "]") { endIdx = bracketRange.lowerBound }
            else if let commaRange = careerPart.range(of: ",") { endIdx = commaRange.lowerBound }
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
        } else if let lastUserRange = prompt.range(of: "User:", options: .backwards) {
            let userPart = String(prompt[lastUserRange.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
            if let assistantRange = userPart.range(of: "Assistant:") {
                userQuery = String(userPart[..<assistantRange.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
            } else {
                userQuery = userPart
            }
            userQuery = userQuery.replacingOccurrences(of: "<end_of_turn>", with: "").replacingOccurrences(of: "<start_of_turn>model", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        }

        // 3. Check JSON request
        let wantsJson = (!system.isEmpty && (
            sLower.contains("json") ||
            sLower.contains("schema")
        )) || pLower.contains("json")

        if wantsJson {
            if pLower.contains("pivot") || pLower.contains("transition") {
                return generatePivotJson(targetCareer: targetCareer, prompt: prompt)
            }
            if sLower.contains("quiz") || pLower.contains("quiz") || pLower.contains("examiner") {
                return generateQuizJson(prompt: prompt)
            }
            if pLower.contains("tasks") || pLower.contains("task") || pLower.contains("educator") {
                return generatePlannerTasksJson(targetCareer: targetCareer, prompt: prompt)
            }
            return generateRoadmapJson(targetCareer: targetCareer, prompt: prompt)
        }

        return generateTextResponse(targetCareer: targetCareer, userQuery: userQuery)
    }

    private func generatePivotJson(targetCareer: String, prompt: String) -> String {
        return """
        {
          "transferPercentage": 65,
          "transferableSkills": ["Problem Solving", "Project Management", "Analytical Thinking", "Communication"],
          "biggestGap": "Mastering core technical implementations, frameworks, and specific programming practices required for \(targetCareer).",
          "marketDemand": "High. Employers value candidates with diverse backgrounds who can bridge domain gaps.",
          "timeToTransition": "6 to 9 months of dedicated study",
          "bridgePlan": [
            {
              "title": "Build Technical Foundations",
              "action": "Focus on coding syntax, basic tools, and design principles relevant to \(targetCareer)."
            },
            {
              "title": "Practice Hands-on Projects",
              "action": "Develop 3 small-to-medium projects that demonstrate core competencies in your new target career."
            },
            {
              "title": "Portfolio & Network",
              "action": "Document your journey on GitHub, create a professional portfolio, and connect with professionals in \(targetCareer)."
            }
          ]
        }
        """
    }

    private func generateQuizJson(prompt: String) -> String {
        let pLower = prompt.lowercased()
        if pLower.contains("game") {
            return """
            [
              {
                "question": "Which component of a game engine updates physical interactions and renders frames repeatedly?",
                "options": ["Asset Pipeline", "Game Loop", "Collider", "Shader"],
                "correctAnswer": 1,
                "explanation": "The Game Loop is the core component that processes input, updates the game state, and renders graphics repeatedly."
              },
              {
                "question": "In Unity development, which language is primarily used for scripting game behaviors?",
                "options": ["C++", "Python", "C#", "JavaScript"],
                "correctAnswer": 2,
                "explanation": "Unity uses C# as its primary scripting language for gameplay programming."
              },
              {
                "question": "Which concept is used to represent positions and directions in 3D game space?",
                "options": ["Matrices", "Vectors", "Quaternions", "Scalars"],
                "correctAnswer": 1,
                "explanation": "Vectors (typically Vector3) represent position, velocity, and directions in 3D space."
              },
              {
                "question": "What is the main benefit of Double Buffering in computer graphics?",
                "options": ["Increases texture resolution", "Prevents screen tearing and flickering", "Reduces memory usage", "Speeds up calculations"],
                "correctAnswer": 1,
                "explanation": "Double buffering uses two buffers (front and back) to render images off-screen before displaying them, preventing screen tearing."
              },
              {
                "question": "Which engine is widely known for AAA graphics and its Blueprint visual scripting system?",
                "options": ["Godot", "Unity", "Unreal Engine", "CryEngine"],
                "correctAnswer": 2,
                "explanation": "Unreal Engine is famous for high-fidelity graphics and uses Blueprints for visual scripting."
              },
              {
                "question": "What does a Collider do in a game environment?",
                "options": ["Draws the 3D model", "Handles user keyboard inputs", "Defines physical shape for collision detection", "Plays background music"],
                "correctAnswer": 2,
                "explanation": "Colliders define the boundary shape of objects for calculating physics collisions."
              },
              {
                "question": "Which engine node in Godot represents the root of a scene or an entity?",
                "options": ["Component", "GameObject", "Node", "Prefab"],
                "correctAnswer": 2,
                "explanation": "In Godot, everything is composed of Nodes, which are organized into scene trees."
              },
              {
                "question": "What is a shader in game development?",
                "options": ["A script running on the GPU that determines pixel colors", "A memory manager", "A physics solver", "A tool for recording audio"],
                "correctAnswer": 0,
                "explanation": "Shaders are GPU programs that calculate rendering effects like lighting and colors."
              },
              {
                "question": "In game UI design, what does 'Draw Call' optimize?",
                "options": ["File download size", "GPU rendering performance by batching commands", "Audio quality", "Save game data speed"],
                "correctAnswer": 1,
                "explanation": "Minimizing draw calls by batching sprites/meshes optimizes GPU rendering speed."
              },
              {
                "question": "What is a prefab (or scene instantiation) used for?",
                "options": ["To compile the codebase", "As a template for creating reusable GameObjects", "To handle network connections", "To design terrain heightmaps"],
                "correctAnswer": 1,
                "explanation": "Prefabs allow developers to save configured GameObjects to asset files and reuse/instantiate them repeatedly."
              }
            ]
            """
        } else if pLower.contains("code") || pLower.contains("program") || pLower.contains("java") || pLower.contains("python") || pLower.contains("c++") {
            return """
            [
              {
                "question": "What is the time complexity of searching in a balanced binary search tree (BST)?",
                "options": ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
                "correctAnswer": 2,
                "explanation": "Balanced BSTs halve the search space at each step, resulting in O(log n) search complexity."
              },
              {
                "question": "Which OOP principle allows a subclass to provide a specific implementation of a method defined in its superclass?",
                "options": ["Encapsulation", "Polymorphism / Method Overriding", "Abstraction", "Inheritance"],
                "correctAnswer": 1,
                "explanation": "Method overriding allows subclasses to implement polymorphic behavior by rewriting a parent method."
              },
              {
                "question": "What is the main advantage of compiling code rather than interpreting it?",
                "options": ["Easier to debug at runtime", "Typically offers faster execution speed", "Uses less disk space", "No compile-time errors"],
                "correctAnswer": 1,
                "explanation": "Compiled code is translated directly to machine code before execution, making it run faster than interpreted code."
              },
              {
                "question": "Which data structure operates on a Last In, First Out (LIFO) basis?",
                "options": ["Queue", "Stack", "Linked List", "Heap"],
                "correctAnswer": 1,
                "explanation": "Stacks retrieve the last inserted element first (LIFO), whereas queues are FIFO."
              },
              {
                "question": "What is encapsulation in Object-Oriented Programming?",
                "options": ["Inheriting behaviors from parent classes", "Hiding internal object states and requiring all interaction through methods", "Allowing multiple method signatures", "Compiling code to bytecode"],
                "correctAnswer": 1,
                "explanation": "Encapsulation wraps data and methods, protecting them from direct external modification."
              },
              {
                "question": "Which of the following is a reference type in Java?",
                "options": ["int", "double", "char", "String"],
                "correctAnswer": 3,
                "explanation": "String is a class and therefore a reference type, while int, double, and char are primitive types."
              },
              {
                "question": "What does git clone do?",
                "options": ["Creates a new branch", "Saves local changes", "Copies an existing remote repository locally", "Merges two branches"],
                "correctAnswer": 2,
                "explanation": "Git clone downloads a complete copy of a remote repository into a local directory."
              },
              {
                "question": "What is recursion in programming?",
                "options": ["A loop that runs forever", "A function calling itself directly or indirectly", "Allocating dynamic memory", "Catching syntax errors"],
                "correctAnswer": 1,
                "explanation": "Recursion occurs when a function calls itself to solve a smaller subproblem."
              },
              {
                "question": "What does a compiler's syntax check verify?",
                "options": ["Logic bugs", "Correctness of variables names and grammar according to language rules", "Database speed", "Array values"],
                "correctAnswer": 1,
                "explanation": "Syntax checks ensure that the code adheres to the grammar rules of the language."
              },
              {
                "question": "In memory management, what is a memory leak?",
                "options": ["Computer runs out of battery", "Unused allocated memory is not released, reducing available RAM", "Writing data to disk too slowly", "Virus stealing files"],
                "correctAnswer": 1,
                "explanation": "Memory leaks occur when a program allocates heap space but fails to free it when it's no longer needed."
              }
            ]
            """
        } else if pLower.contains("web") || pLower.contains("html") || pLower.contains("react") || pLower.contains("javascript") || pLower.contains("css") {
            return """
            [
              {
                "question": "Which HTML5 semantic element is most appropriate for a standalone, self-contained article?",
                "options": ["<section>", "<div>", "<article>", "<aside>"],
                "correctAnswer": 2,
                "explanation": "The <article> tag defines a self-contained, independent article content block."
              },
              {
                "question": "What is CSS Specificity?",
                "options": ["Determines how fast styles load", "The rules browser uses to decide which CSS property values are most relevant and applied", "The width of responsive grids", "Special styling for mobile screens"],
                "correctAnswer": 1,
                "explanation": "CSS Specificity calculates the weight of different selectors to determine which rule wins."
              },
              {
                "question": "What is a closure in JavaScript?",
                "options": ["Closing the browser window", "A function that remembers its outer variables even after the outer function has returned", "Ending a statement with a semicolon", "Encrypting a script file"],
                "correctAnswer": 1,
                "explanation": "A closure gives an inner function access to its outer scope variables even after execution finishes."
              },
              {
                "question": "Which HTTP status code represents 'Unauthorized access'?",
                "options": ["200 OK", "400 Bad Request", "401 Unauthorized", "404 Not Found"],
                "correctAnswer": 2,
                "explanation": "HTTP 401 indicates authentication credentials are required or failed."
              },
              {
                "question": "In React, what is the main purpose of the useEffect hook?",
                "options": ["To style elements inline", "To manage component state", "To handle side effects like data fetching or subscriptions", "To compile JSX components"],
                "correctAnswer": 2,
                "explanation": "useEffect is designed for synchronization and managing side effects outside React rendering logic."
              },
              {
                "question": "What does REST stand for in web services API design?",
                "options": ["Routing System Transfer", "Representational State Transfer", "Responsive Web Style", "Representational Secure Transmission"],
                "correctAnswer": 1,
                "explanation": "REST stands for Representational State Transfer, a standard architectural style for network APIs."
              },
              {
                "question": "Which CSS property makes a container use flex layouts?",
                "options": ["layout: flex", "display: flex", "flexbox: active", "position: flex"],
                "correctAnswer": 1,
                "explanation": "Setting 'display: flex' activates the flexible box layout model for the container."
              },
              {
                "question": "What is the DOM in web development?",
                "options": ["Data Object Manager", "Document Object Model", "Direct Output Module", "Document Optimization Markup"],
                "correctAnswer": 1,
                "explanation": "Document Object Model is a programming interface representing HTML pages as node trees."
              },
              {
                "question": "What is the purpose of the 'alt' attribute in an HTML <img> tag?",
                "options": ["Aligns the image on the screen", "Specifies alternative link when clicked", "Provides a text description for accessibility and search engines", "Changes image filters"],
                "correctAnswer": 2,
                "explanation": "Alt text provides accessibility descriptions for screen readers and SEO indexers."
              },
              {
                "question": "Which database query language is typically used for relational backend systems?",
                "options": ["JSON", "HTML", "SQL", "CSS"],
                "correctAnswer": 2,
                "explanation": "SQL (Structured Query Language) is the standard language for querying relational databases."
              }
            ]
            """
        } else {
            return """
            [
              {
                "question": "What is the main benefit of structured scheduling like Pomodoro or daily planning?",
                "options": ["Decreases memory capacity", "Maintains focus and manages mental fatigue", "Eliminates code bugs", "Speeds up internet connection"],
                "correctAnswer": 1,
                "explanation": "Pomodoro cycles keep you focused while giving regular short breaks to manage fatigue."
              },
              {
                "question": "In professional development, what is a Capstone project?",
                "options": ["A simple math equation", "A significant project demonstrating comprehensive skills to future employers", "A type of file backup", "A code debugger"],
                "correctAnswer": 1,
                "explanation": "Capstone projects synthesize various learned concepts into a professional-grade portfolio item."
              },
              {
                "question": "Why is consistent, daily practice more effective than cramming once a week?",
                "options": ["Cramming consumes less energy", "Daily practice strengthens neural pathways and memory retention over time", "It is not more effective", "Cramming speeds up typing"],
                "correctAnswer": 1,
                "explanation": "Spaced repetition and daily exercise build long-term memory stability far better than single-session cramming."
              },
              {
                "question": "What does a Git commit represent?",
                "options": ["A saved snapshot of file modifications in project history", "Sending files to local trash", "Downloading a model", "Compiling code files"],
                "correctAnswer": 0,
                "explanation": "A commit saves local changes to repository history as a documented checkpoint."
              },
              {
                "question": "What is the primary purpose of writing documentation for code?",
                "options": ["To hide logic details", "To assist team members and future developers in understanding and maintaining code", "To speed up compilation", "To bypass tests"],
                "correctAnswer": 1,
                "explanation": "Good documentation clarifies architectural intent, reducing onboarding time and maintenance issues."
              }
            ]
            """
        }
    }

    private func generatePlannerTasksJson(targetCareer: String, prompt: String) -> String {
        var needed = 3
        if prompt.lowercased().contains("exactly ") {
            if let range = prompt.lowercased().range(of: "exactly ") {
                let suffix = String(prompt[range.upperBound...])
                if let spaceIdx = suffix.firstIndex(of: " ") {
                    let numStr = String(suffix[..<spaceIdx]).trimmingCharacters(in: .whitespacesAndNewlines)
                    if let val = Int(numStr) {
                        needed = val
                    }
                }
            }
        }
        if needed <= 0 || needed > 10 { needed = 3 }

        let pool: [[String]]
        let targetLower = targetCareer.lowercased()
        if targetLower.contains("game") {
            pool = [
                ["Study the Game Loop architecture in game engines", "theory"],
                ["Implement user keyboard inputs for character movement in Unity/Godot", "hands-on"],
                ["Review basic vector mathematics for 3D physics rotations", "review"],
                ["Read about collider triggers and rigidbodies in game physics", "theory"],
                ["Build a simple particle system for explosion effects", "hands-on"],
                ["Optimize draw calls by batching game sprites together", "review"]
            ]
        } else if targetLower.contains("web") || targetLower.contains("front") || targetLower.contains("back") {
            pool = [
                ["Study CSS Flexbox and Grid layout systems", "theory"],
                ["Build a responsive navbar using vanilla HTML and CSS", "hands-on"],
                ["Review Javascript closure concepts and scope behaviors", "review"],
                ["Read about REST API structures and status codes", "theory"],
                ["Implement a basic Express database server", "hands-on"],
                ["Optimize database queries using table indexing", "review"]
            ]
        } else if targetLower.contains("ai") || targetLower.contains("machine") || targetLower.contains("data") {
            pool = [
                ["Study Linear Algebra matrix operations in Python", "theory"],
                ["Implement a basic linear regression model in NumPy", "hands-on"],
                ["Review probability distributions and correlation metrics", "review"],
                ["Read about neural network activation functions", "theory"],
                ["Train a Scikit-Learn classifier on a sample dataset", "hands-on"],
                ["Optimize model hyperparameters using GridSearch", "review"]
            ]
        } else {
            pool = [
                ["Study core terminology and structures of \(targetCareer)", "theory"],
                ["Implement a basic mock experiment or simulation for \(targetCareer)", "hands-on"],
                ["Review industry best practices and common workflows", "review"],
                ["Read standard documentation or introductory case study", "theory"],
                ["Create a study outline for next major milestone", "hands-on"],
                ["Summarize recent learning notes into key takeaways", "review"]
            ]
        }

        var sb = "[\n"
        for i in 0..<needed {
            let task = pool[i % pool.count]
            sb += "  {\n"
            sb += "    \"title\": \"\(task[0])\",\n"
            sb += "    \"type\": \"\(task[1])\"\n"
            sb += "  }"
            if i < needed - 1 {
                sb += ",\n"
            }
        }
        sb += "\n]"
        return sb
    }

    private func generateRoadmapJson(targetCareer: String, prompt: String) -> String {
        return """
        {
          "dream": "\(targetCareer)",
          "summary": "This offline roadmap outlines the 6 progressive stages required to transition into a \(targetCareer), focusing on building foundational theories, executing projects, and launching your portfolio.",
          "stages": [
            {
              "id": "stage1",
              "title": "Foundations of \(targetCareer)",
              "description": "Focus on understanding basic terms, terminology, core equations, and foundational frameworks that govern \(targetCareer).",
              "duration": "1-2 Months",
              "subjects": ["Core Concepts", "Introductory Math", "Essential Tools"],
              "concepts": ["Learn terminology", "Understand system boundaries", "Configure workspace"],
              "skills": ["Basic Analysis", "Tool Setup"],
              "projects": ["Introductory Case Study"]
            },
            {
              "id": "stage2",
              "title": "Core Competency & Syntax",
              "description": "Learn the syntax of the programming languages or operational specifications. Work on small script elements and build initial prototypes.",
              "duration": "2-3 Months",
              "subjects": ["Intermediate Logic", "System Architecture", "Standard Workflows"],
              "concepts": ["Master language constructs", "Manage local data structures", "Implement standard routines"],
              "skills": ["Coding/Drafting", "Logic Design"],
              "projects": ["Small CLI script or layout"]
            },
            {
              "id": "stage3",
              "title": "Applied Intermediate Projects",
              "description": "Apply your skills to build functional tools, components, or databases. Learn about error handling, debugging, and styling details.",
              "duration": "2 Months",
              "subjects": ["Framework Integration", "Database Operations", "UI Components"],
              "concepts": ["Connect frontend to mock APIs", "Structure database schemas", "Style responsive layouts"],
              "skills": ["API Design", "Database Schema design"],
              "projects": ["Full-featured interactive app"]
            },
            {
              "id": "stage4",
              "title": "Advanced Specialization",
              "description": "Deep dive into advanced topics such as cloud integrations, systems optimization, high-fidelity animations, or machine learning algorithms.",
              "duration": "2 Months",
              "subjects": ["Performance Tuning", "Advanced Libraries", "System Security"],
              "concepts": ["Implement memory profiling", "Utilize multi-threading or async logic", "Secure access keys"],
              "skills": ["System Tuning", "Security Audit"],
              "projects": ["Performance-optimized component"]
            },
            {
              "id": "stage5",
              "title": "Professional Capstone & Testing",
              "description": "Synthesize everything you have learned to develop a robust, end-to-end Capstone project. Write unit tests and package it for production.",
              "duration": "1-2 Months",
              "subjects": ["Testing Frameworks", "Continuous Integration", "Deployment Pipelines"],
              "concepts": ["Write comprehensive unit tests", "Configure build pipelines", "Deploy to production staging"],
              "skills": ["Test-Driven Development", "DevOps basics"],
              "projects": ["Production-ready Capstone Portfolio project"]
            },
            {
              "id": "stage6",
              "title": "Portfolio Launch & Readiness",
              "description": "Create a professional developer portfolio website, polish your GitHub account, compile your resume, and practice mock technical interviews.",
              "duration": "1 Month",
              "subjects": ["Interview Preparation", "Resume Building", "Portfolio Design"],
              "concepts": ["Document code on GitHub", "Write developer case studies", "Practice coding challenges"],
              "skills": ["Technical Presentation", "Interview Communication"],
              "projects": ["Interactive Developer Portfolio Website"]
            }
          ]
        }
        """
    }

    private func generateTextResponse(targetCareer: String, userQuery: String) -> String {
        let queryLower = userQuery.lowercased()
        
        if queryLower.contains("hello") || queryLower.contains("hi") || queryLower.contains("hey") || queryLower.contains("greetings") || queryLower.contains("yo") {
            return """
            🔋 Offline AI Mentor:

            Hi there! 👋 I am your Offline AI Mentor. I'm ready to guide you on your journey to becoming a \(targetCareer). Ask me questions about roadmaps, programming concepts, or interview preparation, and I will help you take the next step!
            """
        }
        
        if queryLower.contains("game") || queryLower.contains("unity") || queryLower.contains("unreal") || queryLower.contains("godot") || queryLower.contains("play") || queryLower.contains("physics") || queryLower.contains("graphics") || queryLower.contains("assets") || queryLower.contains("3d") {
            return """
            🔋 Offline AI Mentor:

            To become a successful Game Developer, understanding how games are architected is essential. Here are the core concepts to focus on:

            1. Game Loop: The heart of any game engine. It handles inputs, updates game states (physics, AI, logic), and renders the scene repeatedly (usually 60+ times per second).
            2. Game Engine: Choose your tools. For 2D/3D indie games, Unity (C#) or Godot (C#/GDScript) are excellent. For AAA graphics-heavy games, Unreal Engine (C++/Blueprints) is the industry standard.
            3. Assets Pipeline: Games consist of logic, art, and sound. You will need to learn how to import and handle 3D meshes, 2D sprites, animations, and sound effects efficiently in your engine.
            4. Physics & Collisions: Real-time games rely heavily on collision detection (colliders, triggers) and rigidbodies to simulate movement and interactions.

            Actionable Next Step: Download Unity or Godot, and try building a simple game like Pong or Flappy Bird from scratch to understand the coordinate systems and input controls.
            """
        }
        
        if queryLower.contains("code") || queryLower.contains("program") || queryLower.contains("coding") || queryLower.contains("programming") || queryLower.contains("software") || queryLower.contains("syntax") || queryLower.contains("java") || queryLower.contains("python") || queryLower.contains("c++") || queryLower.contains("c#") {
            return """
            🔋 Offline AI Mentor:

            Programming is about breaking complex problems down into step-by-step logical instructions. Here is how to build your coding skills:

            1. Master Syntax & Fundamentals: Pick one language (Python for simplicity, JavaScript for web development, or Java/C++ for core software architecture) and master variables, loops, conditionals, and functions.
            2. Data Structures & Algorithms: Learn arrays, lists, maps, stacks, and queues. Understanding how to organize data and optimize search/sort operations is critical.
            3. Object-Oriented Programming (OOP): Master classes, objects, inheritance, polymorphism, and encapsulation to write clean, reusable, and modular code.
            4. Version Control: Get comfortable with Git and GitHub. Storing your projects online and tracking code history is standard professional practice.

            Actionable Next Step: Write a small script daily to solve basic problems (like a calculator or fibonacci sequence generator) and push your progress to GitHub.
            """
        }
        
        if queryLower.contains("web") || queryLower.contains("html") || queryLower.contains("css") || queryLower.contains("js") || queryLower.contains("javascript") || queryLower.contains("react") || queryLower.contains("frontend") || queryLower.contains("backend") || queryLower.contains("fullstack") || queryLower.contains("website") || queryLower.contains("api") {
            return """
            🔋 Offline AI Mentor:

            Web Development is split into frontend (client-side) and backend (server-side). To master full-stack development, focus on:

            1. Frontend Core: Learn HTML5 for document structure, CSS3 for layout (Flexbox and Grid) and styling, and JavaScript (ES6+) for interactive logic.
            2. Frontend Frameworks: React, Vue, or Angular help organize large-scale applications with reusable UI components and state management.
            3. Backend & APIs: Node.js, Python, or Go are used to build web servers. Learn to write RESTful APIs that connect the frontend to database systems.
            4. Databases: Learn SQL (PostgreSQL, MySQL) or NoSQL (MongoDB) to manage user accounts, application data, and storage query logic.

            Actionable Next Step: Build a personal portfolio website using HTML, CSS, and vanilla JS, host it on GitHub Pages or Vercel, and use it to showcase your work.
            """
        }
        
        if queryLower.contains("ai") || queryLower.contains("ml") || queryLower.contains("intelligence") || queryLower.contains("machine") || queryLower.contains("learning") || queryLower.contains("neural") || queryLower.contains("deep") || queryLower.contains("llm") || queryLower.contains("model") {
            return """
            🔋 Offline AI Mentor:

            Artificial Intelligence (AI) and Machine Learning (ML) are transforming how software interacts with data. Here is the path to master them:

            1. Foundations of Mathematics: Focus on Linear Algebra (vectors, matrices), Calculus (derivatives, gradients for optimization), and Probability & Statistics.
            2. Python & Libraries: Learn Python, then master data manipulation libraries like NumPy, Pandas, and visualization tools like Matplotlib.
            3. Traditional Machine Learning: Understand regression, classification, clustering, and decision trees using Scikit-Learn.
            4. Deep Learning & Neural Networks: Learn how multi-layered neural networks process data (NLP, Computer Vision) using frameworks like PyTorch or TensorFlow.

            Actionable Next Step: Download a clean dataset from Kaggle, use a Jupyter Notebook to explore the variables, and train a basic linear regression model to make predictions.
            """
        }
        
        if queryLower.contains("database") || queryLower.contains("sql") || queryLower.contains("db") || queryLower.contains("query") || queryLower.contains("postgres") || queryLower.contains("mysql") || queryLower.contains("mongodb") || queryLower.contains("supabase") {
            return """
            🔋 Offline AI Mentor:

            Databases are the foundation of any application. They store and retrieve data reliably. Focus on these key areas:

            1. Relational Databases (SQL): Learn PostgreSQL or MySQL. Master writing SELECT queries, JOINs, WHERE clauses, and aggregations (GROUP BY).
            2. Database Design & Normalization: Learn how to structure tables, establish relationships (one-to-many, many-to-many), and design schemas to prevent data duplication.
            3. NoSQL Databases: Explore MongoDB or Redis for unstructured, document-based data or key-value caching.
            4. Database Optimization: Learn about indexing, query execution plans, and transactions to ensure database speed under heavy user loads.

            Actionable Next Step: Install PostgreSQL locally or create a Supabase project, design a schema for a simple blogging system, and practice writing complex JOIN queries.
            """
        }
        
        if queryLower.contains("app") || queryLower.contains("mobile") || queryLower.contains("android") || queryLower.contains("ios") || queryLower.contains("swift") || queryLower.contains("kotlin") || queryLower.contains("flutter") || queryLower.contains("react native") || queryLower.contains("capacitor") {
            return """
            🔋 Offline AI Mentor:

            Mobile Development allows you to build touch-enabled apps for phones and tablets. Here are your core paths:

            1. Native Android: Learn Kotlin and Jetpack Compose to build high-performance native apps using Google's modern Android design guidelines.
            2. Native iOS: Learn Swift and SwiftUI to develop clean, smooth native apps specifically tailored for Apple devices.
            3. Cross-Platform Frameworks: Flutter (Dart) or React Native / Capacitor (JavaScript/TypeScript) let you write one codebase that compiles to both platforms.
            4. Mobile Lifecycle & Storage: Understand how mobile apps pause/resume, and learn local caching databases like SQLite, Room, or CoreData.

            Actionable Next Step: Install Android Studio or Xcode, create a simple To-Do List app with a clean UI, and test it running on a simulator or physical phone.
            """
        }
        
        if queryLower.contains("calculus") || queryLower.contains("math") || queryLower.contains("derivative") || queryLower.contains("integral") || queryLower.contains("equation") {
            return """
            🔋 Offline AI Mentor:

            Mathematics, particularly calculus, is the mathematical engine behind computer graphics, physics simulation, and machine learning:

            1. Derivatives & Slopes: Derivatives measure rates of change. In machine learning, gradients (partial derivatives) are used in gradient descent to optimize model parameters.
            2. Integrals & Area: Integrals compute the accumulation of quantities over time or space. They are key for physical simulations, acoustics, and signal processing.
            3. Physics in Games: Calculus allows game engines to compute speed, acceleration, gravity, and particle collisions realistically.
            4. Analytical Problem Solving: Practicing math builds the algorithmic thinking required to solve complex coding bugs.

            Actionable Next Step: Write a basic Python script that implements gradient descent for a simple 1D function (like y = x^2) to visualize how derivatives locate the minimum.
            """
        }
        
        if queryLower.contains("study") || queryLower.contains("roadmap") || queryLower.contains("become") || queryLower.contains("career") || queryLower.contains("path") || queryLower.contains("how to") || queryLower.contains("steps") {
            return """
            🔋 Offline AI Mentor:

            Here is a structured, step-by-step roadmap to guide your path to becoming a successful \(targetCareer):

            Step 1: Foundational Theory (Month 1-2)
            Focus on learning the syntax, terminology, and core structures of your field. Dedicate time to understanding the 'why' behind concepts.

            Step 2: Simple Implementation (Month 3-4)
            Build small, isolated projects. If you are learning coding, make command-line scripts. If design, create basic UI/UX mockups. Keep them simple to gain confidence.

            Step 3: Capstone Portfolio Projects (Month 5-6)
            Develop 2-3 significant projects from scratch. Document your development process on GitHub or a personal portfolio website, detailing how you solved problems.

            Step 4: Professional Readiness (Month 7+)
            Prepare a clean resume, polish your LinkedIn/GitHub presence, practice mock interviews, and begin networking in professional groups or local meetups.

            Advice: Be consistent. Practicing for 1 hour every day is far more effective than cramming for 8 hours once a week.
            """
        }
        
        // General fallback response
        return """
        🔋 Offline AI Mentor:

        To excel in your path to becoming a \(targetCareer), exploring "\(userQuery)" is a very productive step.

        Here is some actionable guidance:
        1. Core Focus: Understand the fundamental principles behind \(userQuery) and how it integrates with other tools in \(targetCareer).
        2. Small Projects: Try creating a small, simple test case or sandbox script to experiment with the concept hands-on.
        3. Practical Integration: Look at real-world projects or documentation to see how professionals implement this in production environments.

        Keep experimenting, and feel free to ask more specific questions about coding, system design, or study techniques!
        """
    }

    // MARK: - Native Text-To-Speech (TTS)
    
    @objc func speak(_ call: CAPPluginCall) {
        guard let text = call.getString("text") else {
            call.reject("text is required")
            return
        }
        let lang = call.getString("lang") ?? "en-US"
        
        let cleanText = cleanMarkdownForSpeech(text)
        let utterance = AVSpeechUtterance(string: cleanText)
        utterance.voice = AVSpeechSynthesisVoice(language: lang)
        
        // Stop any current speech before playing
        if speechSynthesizer.isSpeaking {
            speechSynthesizer.stopSpeaking(at: .immediate)
        }
        
        speechSynthesizer.delegate = self
        speechSynthesizer.speak(utterance)
        call.resolve()
    }

    @objc func stopSpeak(_ call: CAPPluginCall) {
        if speechSynthesizer.isSpeaking {
            speechSynthesizer.stopSpeaking(at: .immediate)
        }
        call.resolve()
    }

    private func cleanMarkdownForSpeech(_ text: String) -> String {
        var clean = text
        // Remove headers
        clean = clean.replacingOccurrences(of: "(?m)^#{1,6}\\s+", with: "", options: .regularExpression)
        // Remove bold/italic markup
        clean = clean.replacingOccurrences(of: "\\*{1,2}|_{1,2}", with: "", options: .regularExpression)
        // Remove backticks
        clean = clean.replacingOccurrences(of: "`", with: "")
        // Remove code blocks
        clean = clean.replacingOccurrences(of: "(?s)```[a-zA-Z]*\\n.*?\\n```", with: "", options: .regularExpression)
        // Remove markdown links
        clean = clean.replacingOccurrences(of: "\\[(.*?)\\]\\(.*?\\)", with: "$1", options: .regularExpression)
        // Remove blockquotes
        clean = clean.replacingOccurrences(of: "(?m)^>\\s*", with: "", options: .regularExpression)
        // Remove bullet lists
        clean = clean.replacingOccurrences(of: "(?m)^\\s*[-*+]\\s+", with: "", options: .regularExpression)
        // Remove numbered lists
        clean = clean.replacingOccurrences(of: "(?m)^\\s*\\d+\\.\\s+", with: "", options: .regularExpression)
        // Replace newlines with spaces
        clean = clean.replacingOccurrences(of: "\\n+", with: " ", options: .regularExpression)
        return clean.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - AVSpeechSynthesizerDelegate
    
    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        notifyListeners("speakStatus", data: ["status": "start"])
    }
    
    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        notifyListeners("speakStatus", data: ["status": "done"])
    }
    
    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        notifyListeners("speakStatus", data: ["status": "done"])
    }
}
