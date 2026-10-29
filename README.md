# CELPIP Speaking Test Simulator 🍁

A web application designed to practice the **CELPIP General Speaking Test** with authentic exam timing, automated test progression, high-resolution visual scenes, and instant audio recording & playback review.

---

## 🌟 Key Features

1. **All 8 Official CELPIP Speaking Tasks**:
   - **Task 1: Giving Advice** (Prep: 30s | Speaking: 90s)
     - *Formula:* Empathy → Advice 1 → Advice 2 → Encouragement
   - **Task 2: Talking about a Personal Experience** (Prep: 30s | Speaking: 60s)
     - *Formula:* Context → What happened → Details → Outcome
   - **Task 3: Describing a Scene** (Prep: 30s | Speaking: 60s)
     - *Formula:* General overview → Left / center / right → Key details *(with high-res scene images)*
   - **Task 4: Making Predictions** (Prep: 30s | Speaking: 60s)
     - *Formula:* Describe the scene → Predict events → Explain why *(authentically paired with the Task 3 picture)*
   - **Task 5: Comparing and Persuading** (Selection: 60s | Prep: 60s | Speaking: 60s)
     - *Formula:* Option A vs. B → Choose → Reasons → Persuade *(with side-by-side spec cards and images)*
   - **Task 6: Dealing with a Difficult Situation** (Prep: 60s | Speaking: 60s)
     - *Formula:* Acknowledge → Explain → Propose a solution → Close *(with conflicting dilemma choices)*
   - **Task 7: Expressing Opinions** (Prep: 30s | Speaking: 90s)
     - *Formula:* Opinion → Reason 1 → Reason 2 → Conclusion
   - **Task 8: Describing an Unusual Situation** (Prep: 30s | Speaking: 60s)
     - *Formula:* Identify the situation → Describe details → Explain significance *(with bizarre/unusual images)*

2. **128-Question Bank (`js/questions.json`)**:
   - Contains 16 distinct, realistic prompts for every single task (128 total questions).
   - Choose between a **Randomized Mix** (a fresh question picked randomly for each task) or select any of the **16 Fixed Practice Sets**.
   - Tasks 3 & 4 automatically synchronize so that predictions in Task 4 correspond directly to the scene you analyzed in Task 3.

3. **Authentic Official Timers & Automated Progression**:
   - Press **Start Full Exam Simulation** once at the beginning.
   - The test automatically transitions through Preparation, Audio Beeps, and Recording without manual intervention.
   - Synthesized CELPIP audio beeps (start chime, prep warning, stop double-beep) using the Web Audio API without depending on external sound files.

4. **Microphone Recording & Audio Review Dashboard**:
   - Records your voice for every speaking phase using the browser `MediaRecorder` API.
   - Live microphone volume meter and audio frequency spectrum visualizer while speaking.
   - Post-Exam Review:
     - Listen back to all 8 answers directly in the browser.
     - Download individual recordings or batch download all answers (`.webm`, `.mp4`, or `.wav`).
     - Real-time Speech-to-Text transcription with word count, words per minute (WPM), and filler word detector.
     - Self-evaluation rubric matching CELPIP Performance Standards (Content/Coherence, Vocabulary, Listenability, Task Fulfillment).

5. **Practice Mode**:
   - Want to focus on just Task 5 or Task 8? Switch to **Practice Mode** to drill any task, pause/resume the countdown, skip preparation when ready, or restart a response.

---

## 🚀 How to Run

Because the application loads questions from a local JSON file (`js/questions.json`), standard browser security rules require running via a lightweight local HTTP server:

### Option 1: Node.js (Recommended)
Open your terminal in `c:\canada\celpip` and run:
```bash
node server.js
```
*(or `npm start`)*

Then open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

### Option 2: Python
```bash
python -m http.server 8000
```
Then visit **[http://localhost:8000](http://localhost:8000)**

---

## 📁 Project Structure

```
c:\canada\celpip\
├── index.html               # Main CELPIP test simulator layout and views
├── css\
│   └── style.css            # Responsive styles and CELPIP test center theme
├── js\
│   ├── questions.json       # 64 curated CELPIP prompts, images, & formulas
│   ├── audio-recorder.js    # Web Audio API beeps, MediaRecorder, & visualizer
│   ├── speech-recognition.js# Live speech-to-text transcript & fluency analyzer
│   └── app.js               # Exam state machine and timer orchestrator
└── README.md                # Documentation & quick start guide
```
