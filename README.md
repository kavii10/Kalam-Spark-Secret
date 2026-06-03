# KALAM SPARK - AI Career Intelligence Platform Powered by Google Gemma 4 🚀

> **A Submission for the Gemma 4 Hackathon**
>
> **Kalam Spark** is a comprehensive, AI-powered career mentoring platform designed to democratize career guidance for students. It offers personalized roadmaps, an interactive AI mentor chat, document intelligence, and scientifically-backed learning tools—all driven by the power of **Gemma 4**.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

---

## 🌟 Overall Summary (Agentic AI)

Kalam Spark is built on an **Agentic AI Architecture**. Instead of being a simple chatbot, it utilizes a swarm of specialized AI agents that perceive data, reason over student goals, and execute complex workflows:

- **Career Architect Agent:** Acts as the core engine. It autonomously crawls industry sources (Crawl4AI), analyzes real-time trends, and constructs a progressive 4-stage learning roadmap.
- **Mentor & Coach Agent:** A persistent multimodal agent that maintains session memory. It reasons about the student's education level and current branch to provide context-aware technical guidance.
- **Document Intelligence Agent (File Speaker):** Specialized in RAG (Retrieval-Augmented Generation). It ingests complex documents, extracts key concepts, and can even act as a podcast host by scriptwriting and narrating study material.
- **Opportunity Radar Agent:** Proactively maps real-world internships, hackathons, and jobs to the student's specific learning progress, ensuring actionable career outcomes.

The platform also includes:

- **Daily Planner & Spaced Repetition:** AI-managed tasks synchronized with FSRS v5 and Ebisu algorithms.
- **Career Pivot Analysis:** Quantifies skill gaps and generates autonomous bridge plans for career transitions.

---

## 🧠 Powered by Gemma 4

Kalam Spark heavily leverages the **Gemma 4** model family for its reasoning, summarization, and conversational capabilities. To ensure maximum reliability and accessibility, the application features a **3-tier Multi-LLM failover routing system**:

1. **Tier 1 (Primary Cloud):** OpenRouter API (Gemma 4 31B / 26B)
2. **Tier 2 (Secondary Cloud):** Google AI Studio API (Gemma 4 31B)
3. **Tier 3 (Local Fallback):** Local Ollama daemon (`gemma4:e4b`)

This architecture guarantees that the platform remains functional even if cloud APIs face rate limits or network issues, allowing users to run the entire AI pipeline entirely locally.

---

## 🏗️ Project Structure & Tech Stack

**Frontend:** React 19, TypeScript, Vite, Tailwind CSS (Glassmorphism UI)
**Backend:** FastAPI (Python 3.11+)
**Database & Auth:** Supabase (PostgreSQL)
**AI / RAG:** Gemma 4, ChromaDB (Vector Store), `text-embedding-004`
**Web Scraping:** Crawl4AI, Playwright, BeautifulSoup
**Audio Synthesis:** Edge-TTS (Microsoft Neural voices, supporting 8 Indian languages)

---

## 🚀 How to Run the Project

You can run Kalam Spark in two modes: **Cloud API Mode** (faster, requires API keys) or **Local LLM Mode** (runs completely offline using your hardware).

### Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.11 or higher)
- **Supabase Account** (for database setup)

### 1. Database Setup (Supabase)

1. Create a new project on [Supabase](https://supabase.com/).
2. Navigate to the SQL Editor and run the SQL script found in `database/schema.sql` to create the necessary tables.
3. Get your Project URL and Anon Key from the Project Settings -> API.

### 2. Frontend Setup

```bash
cd frontend
npm install

# Setup environment variables
cp .env.example .env
```

Edit `frontend/.env` and add your Supabase credentials:

```env
VITE_SUPABASE_URL="your-supabase-url"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
VITE_API_URL="http://localhost:8000"
```

Start the frontend development server:

```bash
npm run dev
# The app will run on http://localhost:5173 (or 3000 depending on Vite config)
```

### 3. Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browser for web crawling
playwright install chromium

# Setup environment variables
cp .env.example .env
```

---

### 🌐 Option A: Running with Cloud APIs (Recommended)

Edit `backend/.env` and add your API keys. You only need one, but providing both enables failover.

```env
OPENROUTER_API_KEY="your-openrouter-key"
GEMINI_API_KEY="your-google-ai-studio-key"
```

Start the FastAPI server:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

### 💻 Option B: Running with Local LLM (Offline Mode via Ollama on Laptop/PC)

Kalam Spark can run entirely offline using Ollama as a fallback when API keys are absent or requests fail.

1. Install [Ollama](https://ollama.com/).
2. Open a new terminal and start the Ollama daemon:
   ```bash
   ollama serve
   ```
3. Pull the quantized Gemma 4 model:
   ```bash
   ollama pull gemma4:e4b
   ```
4. Ensure your `backend/.env` has the Ollama configuration (this is usually the default):
   ```env
   OLLAMA_BASE_URL="http://localhost:11434"
   OLLAMA_MODEL="gemma4:e4b"
   ```
5. Start the FastAPI server:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   _Note: If no cloud API keys are provided in `.env`, the backend will automatically route all AI requests to your local Ollama instance._

---

### 📱 Option C: Running on Mobile Offline (Native On-Device Inference)

The application supports native, offline LLM execution directly on your mobile device (Android & iOS) with zero dependency on external servers or network connections.

1. **Download the Quantized Model**:
   - Download the quantized Gemma 4 model file in `.gguf` format: `google_gemma-4-E2B-it-Q2_K.gguf` (or similar).
2. **Move to Device Storage**:
   - **Android**: Place the downloaded `.gguf` file inside your phone's main **Downloads** folder (i.e. `/Download/google_gemma-4-E2B-it-Q2_K.gguf`).
   - **iOS**: Import the `.gguf` file via the Files app into the app's **Documents** folder.
3. **Select or Initialize the Model in the App**:
   - Open the app's sidebar settings.
   - Click **Select Model File** (on native mobile devices) and pick the `.gguf` file from the storage.
   - The app will copy and load the model locally. You are now ready to run offline chats, tasks, and quizzes on your mobile device!

---

## 🏛️ System Architecture

For a comprehensive layout of the app's design patterns, agent swarm workflows, data synchronization pipelines, and FSRS spacing metrics, please refer to the detailed [ARCHITECTURE.md](ARCHITECTURE.md) document.

---

## 📜 License

This project is released under the **Apache License 2.0**.

You may obtain a copy of the License at:
http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
