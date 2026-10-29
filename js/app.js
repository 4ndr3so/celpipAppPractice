/**
 * CELPIP Speaking Exam Simulator - Main Application Controller
 */

class CelpipApp {
  constructor() {
    this.audioEngine = new CelpipAudioEngine();
    this.speechAnalyzer = new CelpipSpeechAnalyzer();
    this.questionBank = null;

    // Exam State
    this.mode = 'exam'; // 'exam' or 'practice'
    this.currentTaskIndex = 0; // 0 to 7
    this.sessionQuestions = []; // 8 chosen question objects
    this.phase = 'idle'; // 'idle', 'selection', 'prep', 'speaking', 'completed', 'results'
    this.timerSeconds = 0;
    this.totalPhaseSeconds = 0;
    this.timerInterval = null;
    this.isPaused = false;
    this.showHints = false; // By default hidden in exam mode (toggleable)
    this.taskSelections = {}; // Stores chosen options for Task 5 and Task 6

    this.initDOMReferences();
    this.bindEvents();
    this.loadQuestionBank();
  }

  initDOMReferences() {
    // Views
    this.setupView = document.getElementById('view-setup');
    this.examView = document.getElementById('view-exam');
    this.resultsView = document.getElementById('view-results');
    this.imageModal = document.getElementById('image-modal');
    this.modalImg = document.getElementById('modal-img');
    this.modalCaption = document.getElementById('modal-caption');

    // Header & Meta
    this.headerTaskLabel = document.getElementById('header-task-label');
    this.headerModeBadge = document.getElementById('header-mode-badge');
    this.taskNavDots = document.getElementById('task-nav-dots');

    // Hints & Strategy Controls
    this.formulaBannerWrapper = document.getElementById('formula-banner-wrapper');
    this.btnToggleHints = document.getElementById('btn-toggle-hints');
    this.hintModeIndicator = document.getElementById('exam-hint-mode-indicator');

    // Timer & Status
    this.timerDisplay = document.getElementById('timer-display');
    this.timerPhaseLabel = document.getElementById('timer-phase-label');
    this.timerProgressBar = document.getElementById('timer-progress-bar');
    this.liveIndicator = document.getElementById('live-indicator');
    this.liveIndicatorText = document.getElementById('live-indicator-text');
    this.visualizerCanvas = document.getElementById('visualizer-canvas');

    // Task Content
    this.taskTitle = document.getElementById('task-title');
    this.taskSubtitle = document.getElementById('task-subtitle');
    this.formulaBadge = document.getElementById('formula-badge');
    this.formulaDetails = document.getElementById('formula-details');
    this.promptContainer = document.getElementById('prompt-container');
    this.mediaContainer = document.getElementById('media-container');

    // Controls
    this.btnStartSpeaking = document.getElementById('btn-start-speaking');
    this.btnFinishTask = document.getElementById('btn-finish-task');
    this.btnPauseResume = document.getElementById('btn-pause-resume');
    this.btnRestartTask = document.getElementById('btn-restart-task');
    this.practiceControls = document.getElementById('practice-controls');
  }

  bindEvents() {
    // Setup View Actions
    document.getElementById('btn-start-full-exam').addEventListener('click', () => {
      this.startSimulation('exam');
    });

    document.getElementById('btn-start-practice').addEventListener('click', () => {
      this.startSimulation('practice');
    });

    // Mic test button on setup view
    const btnTestMic = document.getElementById('btn-test-mic');
    if (btnTestMic) {
      btnTestMic.addEventListener('click', async () => {
        btnTestMic.disabled = true;
        btnTestMic.textContent = 'Testing microphone...';
        const res = await this.audioEngine.requestMicPermission();
        if (res.success) {
          const micFill = document.getElementById('setup-mic-meter');
          const micCanvas = document.getElementById('setup-mic-canvas');
          this.audioEngine.setupMicMeter(micFill, micCanvas);
          btnTestMic.textContent = 'Microphone Connected';
          btnTestMic.classList.remove('btn-secondary');
          btnTestMic.classList.add('btn-success');
        } else {
          btnTestMic.disabled = false;
          btnTestMic.textContent = 'Retry Mic Test';
          alert(res.error || 'Microphone error');
        }
      });
    }

    // Task Actions
    this.btnStartSpeaking.addEventListener('click', () => {
      this.skipToSpeaking();
    });

    this.btnFinishTask.addEventListener('click', () => {
      this.finishCurrentPhaseEarly();
    });

    this.btnPauseResume.addEventListener('click', () => {
      this.togglePause();
    });

    this.btnRestartTask.addEventListener('click', () => {
      this.restartCurrentTask();
    });

    // Modal Close
    document.getElementById('close-modal-btn').addEventListener('click', () => {
      this.imageModal.classList.add('hidden');
    });
    this.imageModal.addEventListener('click', (e) => {
      if (e.target === this.imageModal) {
        this.imageModal.classList.add('hidden');
      }
    });

    // Results View Actions
    document.getElementById('btn-retake-exam').addEventListener('click', () => {
      this.showSetupView();
    });

    document.getElementById('btn-download-all').addEventListener('click', () => {
      this.downloadAllAudio();
    });

    // Toggle Hints & Strategy Button
    if (this.btnToggleHints) {
      this.btnToggleHints.addEventListener('click', () => {
        this.toggleHints();
      });
    }

    // Toggle Formula Details
    document.getElementById('formula-toggle-btn').addEventListener('click', () => {
      this.formulaDetails.classList.toggle('hidden');
    });
  }

  toggleHints() {
    this.showHints = !this.showHints;
    this.updateHintsUI();
  }

  updateHintsUI() {
    if (!this.btnToggleHints) return;

    if (this.showHints) {
      this.btnToggleHints.textContent = '👁️ Hide Formula & Hints';
      this.btnToggleHints.classList.add('active');
      if (this.hintModeIndicator) {
        this.hintModeIndicator.textContent = '💡 Strategy & Hints Visible';
        this.hintModeIndicator.className = 'hint-mode-status active';
      }
      if (this.formulaBannerWrapper) {
        this.formulaBannerWrapper.classList.remove('hidden');
      }
      document.querySelectorAll('.coaching-hints-item').forEach(el => el.classList.remove('hidden'));
      document.querySelectorAll('.official-guidelines-item').forEach(el => el.classList.add('hidden'));
    } else {
      this.btnToggleHints.textContent = '💡 Show Formula & Hints';
      this.btnToggleHints.classList.remove('active');
      if (this.hintModeIndicator) {
        this.hintModeIndicator.textContent = '🔒 Authentic Exam Mode (Hints Hidden)';
        this.hintModeIndicator.className = 'hint-mode-status';
      }
      if (this.formulaBannerWrapper) {
        this.formulaBannerWrapper.classList.add('hidden');
      }
      document.querySelectorAll('.coaching-hints-item').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.official-guidelines-item').forEach(el => el.classList.remove('hidden'));
    }
  }

  async loadQuestionBank() {
    try {
      const response = await fetch('js/questions.json');
      if (!response.ok) {
        throw new Error('Failed to load questions.json: ' + response.statusText);
      }
      this.questionBank = await response.json();
      console.log('CELPIP Question bank loaded successfully.');
    } catch (err) {
      console.error('Error loading question bank:', err);
      // Fallback notification
      alert('Unable to load question bank JSON. Make sure you are serving this from a web server or local server.');
    }
  }

  // Prepares the 8 questions for the session
  prepareSessionQuestions() {
    const questions = [];
    const questionSetChoice = document.getElementById('question-set-selector').value;

    // Determine Scene index for Task 3 and Task 4 so they are authentically paired
    let sceneIndex = 0;
    const task3Total = this.questionBank && this.questionBank.tasks['3'] ? this.questionBank.tasks['3'].questions.length : 16;
    if (questionSetChoice === 'random') {
      sceneIndex = Math.floor(Math.random() * task3Total);
    } else {
      sceneIndex = parseInt(questionSetChoice, 10);
    }

    for (let taskNum = 1; taskNum <= 8; taskNum++) {
      const taskData = this.questionBank.tasks[taskNum.toString()];
      let chosenQ;

      if (taskNum === 3 || taskNum === 4) {
        // Authentic CELPIP pairing: Task 4 uses the same scene as Task 3
        chosenQ = taskData.questions[sceneIndex % taskData.questions.length];
      } else if (questionSetChoice === 'random') {
        const randIndex = Math.floor(Math.random() * taskData.questions.length);
        chosenQ = taskData.questions[randIndex];
      } else {
        const setIdx = parseInt(questionSetChoice, 10);
        chosenQ = taskData.questions[setIdx % taskData.questions.length];
      }

      questions.push({
        taskNumber: taskNum,
        taskMeta: taskData,
        question: chosenQ
      });
    }

    this.sessionQuestions = questions;
  }

  async startSimulation(mode = 'exam') {
    if (!this.questionBank) {
      await this.loadQuestionBank();
    }

    // Warm up audio context on user gesture
    this.audioEngine.initAudioContext();
    const micRes = await this.audioEngine.requestMicPermission();
    if (!micRes.success) {
      const proceedAnyway = confirm(micRes.error + '\n\nDo you want to proceed in practice mode without microphone recording?');
      if (!proceedAnyway) return;
    }

    this.mode = mode;
    this.showHints = false; // Always default to hidden for authentic real exam simulation
    this.prepareSessionQuestions();

    // Check if user selected a specific starting task in practice mode
    if (this.mode === 'practice') {
      const practiceTaskSelect = document.getElementById('practice-task-selector');
      const startTask = parseInt(practiceTaskSelect.value, 10) || 1;
      this.currentTaskIndex = startTask - 1;
    } else {
      this.currentTaskIndex = 0;
    }

    this.showExamView();
    this.updateHintsUI();
    this.loadTask(this.currentTaskIndex);
  }

  showSetupView() {
    this.stopTimer();
    this.audioEngine.stopRecording();
    this.speechAnalyzer.stopListening();

    this.setupView.classList.remove('hidden');
    this.examView.classList.add('hidden');
    this.resultsView.classList.add('hidden');
  }

  showExamView() {
    this.setupView.classList.add('hidden');
    this.examView.classList.remove('hidden');
    this.resultsView.classList.add('hidden');

    this.headerModeBadge.textContent = this.mode === 'exam' ? 'FULL EXAM SIMULATION' : 'PRACTICE MODE';
    this.headerModeBadge.className = this.mode === 'exam' ? 'badge badge-exam' : 'badge badge-practice';

    if (this.mode === 'practice') {
      this.practiceControls.classList.remove('hidden');
    } else {
      this.practiceControls.classList.add('hidden');
    }

    this.renderTaskNavigationDots();
  }

  showResultsView() {
    this.stopTimer();
    this.setupView.classList.add('hidden');
    this.examView.classList.add('hidden');
    this.resultsView.classList.remove('hidden');

    this.renderResultsDashboard();
  }

  renderTaskNavigationDots() {
    this.taskNavDots.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const dot = document.createElement('button');
      dot.className = `nav-dot ${i === this.currentTaskIndex ? 'active' : ''} ${i < this.currentTaskIndex ? 'completed' : ''}`;
      dot.title = `Task ${i + 1}`;
      dot.textContent = `${i + 1}`;
      if (this.mode === 'practice') {
        dot.addEventListener('click', () => {
          this.switchTaskInPractice(i);
        });
      }
      this.taskNavDots.appendChild(dot);
    }
  }

  switchTaskInPractice(index) {
    if (this.mode !== 'practice') return;
    this.stopTimer();
    this.audioEngine.stopRecording();
    this.speechAnalyzer.stopListening();
    this.currentTaskIndex = index;
    this.renderTaskNavigationDots();
    this.loadTask(this.currentTaskIndex);
  }

  // Load a specific task
  loadTask(index) {
    this.currentTaskIndex = index;
    const taskData = this.sessionQuestions[index];
    const { taskNumber, taskMeta, question } = taskData;

    this.renderTaskNavigationDots();
    this.headerTaskLabel.textContent = `Task ${taskNumber} of 8`;
    this.taskTitle.textContent = `Task ${taskNumber}: ${taskMeta.title}`;
    this.taskSubtitle.textContent = taskMeta.subtitle || '';

    // Formula setup
    this.formulaBadge.textContent = taskMeta.formula;
    this.renderFormulaSteps(taskMeta.formulaSteps);

    // Default task selection if not yet set
    if (!this.taskSelections[taskNumber]) {
      this.taskSelections[taskNumber] = 'A';
    }

    // Determine initial phase:
    // Task 5 starts with a 60s Selection phase
    if (taskNumber === 5) {
      this.startSelectionPhase(taskMeta, question);
    } else {
      this.startPrepPhase(taskMeta, question);
    }
  }

  renderFormulaSteps(steps) {
    if (!steps || !steps.length) {
      this.formulaDetails.innerHTML = '';
      return;
    }

    let html = '<div class="formula-steps-grid">';
    steps.forEach((step, idx) => {
      html += `
        <div class="formula-step-card">
          <div class="step-num">Step ${idx + 1}</div>
          <div class="step-name">${step.step}</div>
          <p class="step-desc">${step.description}</p>
          <div class="step-starters">
            <strong>Key Starters:</strong>
            <ul>
              ${step.starters.map(s => `<li>"${s}"</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    });
    html += '</div>';
    this.formulaDetails.innerHTML = html;
  }

  // Phase 1: Selection Phase (Task 5: Comparing and Persuading)
  startSelectionPhase(taskMeta, question) {
    this.phase = 'selection';
    this.totalPhaseSeconds = question.selectionTime || taskMeta.selectionTime || 60;
    this.timerSeconds = this.totalPhaseSeconds;

    this.updateStatusBadge('SELECTION PHASE', 'status-selection');
    this.timerPhaseLabel.textContent = 'Time to Choose Option:';
    this.btnStartSpeaking.textContent = 'Confirm Choice & Start Preparation';
    this.btnStartSpeaking.disabled = false;
    this.btnFinishTask.disabled = true;

    this.renderTask5SelectionView(question);
    this.startCountdown(() => {
      // When 60s selection expires, automatically advance to Prep
      this.startPrepPhase(taskMeta, question);
    });
  }

  renderTask5SelectionView(question) {
    let html = `
      <div class="prompt-box">
        <div class="prompt-badge">TASK INSTRUCTION</div>
        <p class="prompt-text">${question.prompt}</p>
        <div class="prompt-target"><strong>Your Persona / Audience:</strong> ${question.targetAudience || 'Your friend/family member'}</div>
        <div class="selection-instruction-banner">
          👉 <strong>Click on either Option A or Option B below</strong> to choose which one you want to convince your audience to select.
        </div>
      </div>
    `;
    this.promptContainer.innerHTML = html;

    const optA = question.optionA;
    const optB = question.optionB;

    let mediaHtml = `
      <div class="comparison-grid">
        <!-- Option A -->
        <div class="comparison-card ${this.taskSelections[5] === 'A' ? 'selected' : ''}" id="card-option-a">
          <div class="card-header">
            <span class="card-tag">OPTION A</span>
            <input type="radio" name="task5-choice" value="A" ${this.taskSelections[5] === 'A' ? 'checked' : ''} id="radio-opt-a">
          </div>
          <div class="card-image-box">
            <img src="${optA.imageUrl}" alt="${optA.name}" class="comparison-img zoomable-img" data-caption="${optA.name}" />
          </div>
          <h4 class="comparison-title">${optA.name}</h4>
          <div class="comparison-price">${optA.price}</div>
          <ul class="comparison-specs">
            ${optA.fuelEfficiency ? `<li><strong>Efficiency:</strong> ${optA.fuelEfficiency}</li>` : ''}
            ${optA.size ? `<li><strong>Size:</strong> ${optA.size}</li>` : ''}
            ${optA.performance ? `<li><strong>Specs:</strong> ${optA.performance}</li>` : ''}
            ${optA.facilities ? `<li><strong>Facilities:</strong> ${optA.facilities}</li>` : ''}
            ${optA.pace ? `<li><strong>Pace:</strong> ${optA.pace}</li>` : ''}
            ${optA.pros ? `<li class="pro-item"><strong>Pros:</strong> ${optA.pros}</li>` : ''}
            ${optA.cons ? `<li class="con-item"><strong>Cons:</strong> ${optA.cons}</li>` : ''}
          </ul>
        </div>

        <!-- Option B -->
        <div class="comparison-card ${this.taskSelections[5] === 'B' ? 'selected' : ''}" id="card-option-b">
          <div class="card-header">
            <span class="card-tag">OPTION B</span>
            <input type="radio" name="task5-choice" value="B" ${this.taskSelections[5] === 'B' ? 'checked' : ''} id="radio-opt-b">
          </div>
          <div class="card-image-box">
            <img src="${optB.imageUrl}" alt="${optB.name}" class="comparison-img zoomable-img" data-caption="${optB.name}" />
          </div>
          <h4 class="comparison-title">${optB.name}</h4>
          <div class="comparison-price">${optB.price}</div>
          <ul class="comparison-specs">
            ${optB.fuelEfficiency ? `<li><strong>Efficiency:</strong> ${optB.fuelEfficiency}</li>` : ''}
            ${optB.size ? `<li><strong>Size:</strong> ${optB.size}</li>` : ''}
            ${optB.performance ? `<li><strong>Specs:</strong> ${optB.performance}</li>` : ''}
            ${optB.facilities ? `<li><strong>Facilities:</strong> ${optB.facilities}</li>` : ''}
            ${optB.pace ? `<li><strong>Pace:</strong> ${optB.pace}</li>` : ''}
            ${optB.pros ? `<li class="pro-item"><strong>Pros:</strong> ${optB.pros}</li>` : ''}
            ${optB.cons ? `<li class="con-item"><strong>Cons:</strong> ${optB.cons}</li>` : ''}
          </ul>
        </div>
      </div>
    `;
    this.mediaContainer.innerHTML = mediaHtml;
    this.setupZoomableImages();

    // Bind card selection clicks
    const cardA = document.getElementById('card-option-a');
    const cardB = document.getElementById('card-option-b');
    const radioA = document.getElementById('radio-opt-a');
    const radioB = document.getElementById('radio-opt-b');

    const selectA = () => {
      this.taskSelections[5] = 'A';
      cardA.classList.add('selected');
      cardB.classList.remove('selected');
      radioA.checked = true;
    };
    const selectB = () => {
      this.taskSelections[5] = 'B';
      cardB.classList.add('selected');
      cardA.classList.remove('selected');
      radioB.checked = true;
    };

    cardA.addEventListener('click', selectA);
    cardB.addEventListener('click', selectB);
    radioA.addEventListener('change', selectA);
    radioB.addEventListener('change', selectB);
  }

  // Phase 2: Preparation Phase
  startPrepPhase(taskMeta, question) {
    this.phase = 'prep';
    this.totalPhaseSeconds = taskMeta.prepTime || 30;
    this.timerSeconds = this.totalPhaseSeconds;

    this.updateStatusBadge('PREPARATION TIME', 'status-prep');
    this.timerPhaseLabel.textContent = 'Preparation Time:';
    this.btnStartSpeaking.textContent = 'Start Speaking Now (Skip Prep)';
    this.btnStartSpeaking.disabled = false;
    this.btnFinishTask.disabled = true;

    this.renderTaskContent(taskMeta, question);
    this.startCountdown(() => {
      // At end of prep time: play beep and automatically start recording
      this.startSpeakingPhase(taskMeta, question);
    });
  }

  // Phase 3: Speaking Phase (Microphone Recording)
  async startSpeakingPhase(taskMeta, question) {
    this.phase = 'speaking';
    this.totalPhaseSeconds = taskMeta.speakTime || 60;
    this.timerSeconds = this.totalPhaseSeconds;

    this.updateStatusBadge('RECORDING NOW', 'status-recording');
    this.timerPhaseLabel.textContent = 'Recording Time:';
    this.btnStartSpeaking.disabled = true;
    this.btnFinishTask.disabled = false;

    // Start audio recording and live visualizer
    try {
      await this.audioEngine.startRecording(taskMeta.taskNumber, this.visualizerCanvas);
    } catch (err) {
      console.warn('Microphone recording error:', err);
    }

    // Start live speech analysis if supported
    this.speechAnalyzer.startListening(taskMeta.taskNumber);

    this.startCountdown(() => {
      // Speaking time finished
      this.completeCurrentTask();
    });
  }

  // Countdown timer engine
  startCountdown(onComplete) {
    this.stopTimer();
    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      if (this.isPaused) return;

      this.timerSeconds--;
      this.updateTimerDisplay();

      // Audio cue 3 seconds before prep ends
      if (this.phase === 'prep' && this.timerSeconds === 3) {
        this.audioEngine.playBeep('prepWarning');
      }

      if (this.timerSeconds <= 0) {
        this.stopTimer();
        if (onComplete) {
          onComplete();
        }
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  updateTimerDisplay() {
    const mins = Math.floor(Math.max(0, this.timerSeconds) / 60);
    const secs = Math.max(0, this.timerSeconds) % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.timerDisplay.textContent = formatted;

    // Progress bar
    if (this.totalPhaseSeconds > 0) {
      const pct = Math.max(0, Math.min(100, (this.timerSeconds / this.totalPhaseSeconds) * 100));
      this.timerProgressBar.style.width = `${pct}%`;

      // Color progression based on phase
      if (this.phase === 'selection') {
        this.timerProgressBar.className = 'progress-bar-fill progress-selection';
      } else if (this.phase === 'prep') {
        this.timerProgressBar.className = 'progress-bar-fill progress-prep';
      } else if (this.phase === 'speaking') {
        if (this.timerSeconds <= 10) {
          this.timerProgressBar.className = 'progress-bar-fill progress-urgent';
        } else {
          this.timerProgressBar.className = 'progress-bar-fill progress-speaking';
        }
      }
    }
  }

  updateStatusBadge(text, className) {
    this.liveIndicatorText.textContent = text;
    this.liveIndicator.className = `status-indicator ${className}`;
  }

  // Skip prep and immediately record
  skipToSpeaking() {
    if (this.phase === 'selection') {
      const taskData = this.sessionQuestions[this.currentTaskIndex];
      this.startPrepPhase(taskData.taskMeta, taskData.question);
    } else if (this.phase === 'prep') {
      this.stopTimer();
      const taskData = this.sessionQuestions[this.currentTaskIndex];
      this.startSpeakingPhase(taskData.taskMeta, taskData.question);
    }
  }

  // Finish speaking early
  async finishCurrentPhaseEarly() {
    if (this.phase === 'speaking') {
      this.stopTimer();
      await this.completeCurrentTask();
    }
  }

  // Toggle pause (Practice Mode only)
  togglePause() {
    if (this.mode !== 'practice') return;
    this.isPaused = !this.isPaused;
    this.btnPauseResume.textContent = this.isPaused ? 'Resume' : 'Pause';
    this.btnPauseResume.classList.toggle('btn-warning', this.isPaused);
  }

  // Restart current task (Practice Mode only)
  restartCurrentTask() {
    if (this.mode !== 'practice') return;
    this.stopTimer();
    this.audioEngine.stopRecording();
    this.speechAnalyzer.stopListening();
    this.isPaused = false;
    this.btnPauseResume.textContent = 'Pause';
    this.loadTask(this.currentTaskIndex);
  }

  // Complete task and automatically advance or show results
  async completeCurrentTask() {
    this.stopTimer();
    this.updateStatusBadge('SAVING RECORDING...', 'status-saving');

    // Stop recorder & speech analyzer
    await this.audioEngine.stopRecording();
    this.speechAnalyzer.stopListening();

    // Check if exam is finished
    if (this.currentTaskIndex >= 7) {
      // Completed all 8 tasks!
      this.showToast('Congratulations! You completed all 8 Speaking tasks.', 'success');
      setTimeout(() => {
        this.showResultsView();
      }, 1500);
    } else {
      // In Exam Mode: Brief transition screen, then auto-advance
      this.showToast(`Task ${this.currentTaskIndex + 1} complete. Preparing next question...`, 'info');
      setTimeout(() => {
        this.currentTaskIndex++;
        this.loadTask(this.currentTaskIndex);
      }, 1800);
    }
  }

  renderTaskContent(taskMeta, question) {
    const taskNum = taskMeta.taskNumber;

    // Left Column: Prompt and Structure
    let promptHtml = `
      <div class="prompt-box">
        <div class="prompt-badge">TASK ${taskNum} INSTRUCTION</div>
        <p class="prompt-text">${question.prompt}</p>
      </div>

      <!-- Collapsible Coaching & Assistance Panel -->
      <div class="coaching-hints-block coaching-hints-item ${this.showHints ? '' : 'hidden'}">
        <div class="hints-box-header">
          <span class="hints-box-badge">💡 COACHING STRATEGY & SUGGESTIONS</span>
        </div>

        ${question.targetAudience ? `
          <div class="prompt-target">
            <strong>Target Persona / Audience:</strong> ${question.targetAudience}
          </div>
        ` : ''}
        
        ${question.keyPoints ? `
          <div class="key-points-box">
            <strong>Key Suggestions to Include:</strong>
            <ul>
              ${question.keyPoints.map(kp => `<li>${kp}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${question.sampleStarters ? `
          <div class="sample-starters-box">
            <strong>Recommended Transition Starters:</strong>
            <div class="starter-chips">
              ${question.sampleStarters.map(ss => `<span class="starter-chip">${ss}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Right Column: Media, Images, or Dilemma Cards
    let mediaHtml = '';

    if (taskNum === 3 || taskNum === 4) {
      // Scene Image for Task 3 & 4
      mediaHtml = `
        <div class="media-card">
          <div class="media-header">
            <h4>${question.title}</h4>
            <span class="click-to-zoom">🔍 Click image to enlarge</span>
          </div>
          <div class="scene-image-wrapper">
            <img src="${question.imageUrl}" alt="${question.title}" class="scene-img zoomable-img" data-caption="${question.title}" />
          </div>
          ${question.sceneDetails ? `
            <div class="scene-breakdown-card coaching-hints-item ${this.showHints ? '' : 'hidden'}">
              <h5>Systematic Observation Guide:</h5>
              <div class="observation-grid">
                <div><strong>Left:</strong> ${question.sceneDetails.left}</div>
                <div><strong>Center:</strong> ${question.sceneDetails.center}</div>
                <div><strong>Right:</strong> ${question.sceneDetails.right}</div>
              </div>
            </div>
          ` : ''}
          ${question.clues ? `
            <div class="scene-breakdown-card coaching-hints-item ${this.showHints ? '' : 'hidden'}">
              <h5>Clues to Predict What Happens Next:</h5>
              <ul>
                ${question.clues.map(c => `<li>${c}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    } else if (taskNum === 5) {
      // Comparison View with Chosen Option highlighted
      const chosenKey = this.taskSelections[5] || 'A';
      const chosenOpt = chosenKey === 'A' ? question.optionA : question.optionB;
      const otherOpt = chosenKey === 'A' ? question.optionB : question.optionA;

      mediaHtml = `
        <div class="task5-selected-view">
          <div class="chosen-banner">
            ⭐ You chose: <strong>${chosenOpt.name}</strong> (Option ${chosenKey})
          </div>
          <div class="chosen-card">
            <div class="card-image-box">
              <img src="${chosenOpt.imageUrl}" alt="${chosenOpt.name}" class="comparison-img zoomable-img" data-caption="${chosenOpt.name}" />
            </div>
            <h4>${chosenOpt.name}</h4>
            <div class="comparison-price">${chosenOpt.price}</div>
            <ul class="comparison-specs">
              ${chosenOpt.pros ? `<li class="pro-item"><strong>Your Strongest Points:</strong> ${chosenOpt.pros}</li>` : ''}
              ${otherOpt.cons ? `<li class="con-item"><strong>Flaws of ${otherOpt.name}:</strong> ${otherOpt.cons}</li>` : ''}
            </ul>
          </div>
        </div>
      `;
    } else if (taskNum === 6) {
      // Difficult Situation Dilemma Choices
      const selectedChoice = this.taskSelections[6] || 'A';
      mediaHtml = `
        <div class="dilemma-container">
          <h4>Choose which party you will address:</h4>
          
          <div class="dilemma-card ${selectedChoice === 'A' ? 'selected' : ''}" id="dilemma-card-a">
            <div class="dilemma-header">
              <input type="radio" name="dilemma-choice" value="A" id="radio-dilemma-a" ${selectedChoice === 'A' ? 'checked' : ''}>
              <strong>${question.choiceA.title}</strong>
            </div>
            <p><strong>Speaking to:</strong> ${question.choiceA.target}</p>
            <p class="dilemma-context">${question.choiceA.context}</p>
          </div>

          <div class="dilemma-card ${selectedChoice === 'B' ? 'selected' : ''}" id="dilemma-card-b">
            <div class="dilemma-header">
              <input type="radio" name="dilemma-choice" value="B" id="radio-dilemma-b" ${selectedChoice === 'B' ? 'checked' : ''}>
              <strong>${question.choiceB.title}</strong>
            </div>
            <p><strong>Speaking to:</strong> ${question.choiceB.target}</p>
            <p class="dilemma-context">${question.choiceB.context}</p>
          </div>
        </div>
      `;
    } else if (taskNum === 8) {
      // Unusual Situation Image
      mediaHtml = `
        <div class="media-card">
          <div class="media-header">
            <h4>${question.title}</h4>
            <span class="click-to-zoom">🔍 Click image to enlarge</span>
          </div>
          <div class="scene-image-wrapper">
            <img src="${question.imageUrl}" alt="${question.title}" class="scene-img zoomable-img" data-caption="${question.title}" />
          </div>
          ${question.features ? `
            <div class="scene-breakdown-card coaching-hints-item ${this.showHints ? '' : 'hidden'}">
              <h5>Notable Visual Features to Describe:</h5>
              <ul>
                ${question.features.map(f => `<li>${f}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      // Text-based tasks (Task 1, 2, 7)
      mediaHtml = `
        <!-- Authentic Official Exam Standards Card (shown when hints are hidden) -->
        <div class="official-test-card official-guidelines-item ${this.showHints ? 'hidden' : ''}">
          <div class="official-card-header">
            <span class="official-icon">🎙️</span>
            <h4>Official CELPIP Speaking Guide</h4>
          </div>
          <p class="official-lead-text">You are in official exam simulation mode. When the beep sounds, your microphone will record automatically.</p>
          <ul class="official-guidelines-list">
            <li>Read the prompt on the left carefully during your preparation time.</li>
            <li>Speak clearly and audibly into your microphone when recording begins.</li>
            <li>Continue speaking at a natural, steady pace until the timer reaches zero.</li>
            <li>Your answer is recorded automatically and saved for post-exam review.</li>
          </ul>
          <div class="official-reminder-tip">
            💡 <em>Need assistance? Click the <strong>"Show Formula & Hints"</strong> button above to reveal suggested points and transition starters.</em>
          </div>
        </div>

        <!-- Strategy Coaching Card (shown when hints are toggled ON) -->
        <div class="coaching-card coaching-hints-item ${this.showHints ? '' : 'hidden'}">
          <h4>CELPIP Strategy & Execution Formula</h4>
          <p class="formula-tagline">${taskMeta.formula}</p>
          <div class="coaching-points">
            <div class="coach-item">
              <span class="coach-icon">🎯</span>
              <div>
                <strong>Task Fulfillment:</strong> Address every part of the prompt without going off-topic.
              </div>
            </div>
            <div class="coach-item">
              <span class="coach-icon">⏱️</span>
              <div>
                <strong>Pacing:</strong> Aim for ~120-140 words per minute. Don't rush; speak smoothly with natural pauses.
              </div>
            </div>
            <div class="coach-item">
              <span class="coach-icon">🗣️</span>
              <div>
                <strong>Tone & Intonation:</strong> Sound engaged and confident. Match your register to the persona.
              </div>
            </div>
          </div>
        </div>
      `;
    }

    this.promptContainer.innerHTML = promptHtml;
    this.mediaContainer.innerHTML = mediaHtml;
    this.setupZoomableImages();

    // Bind dilemma click if task 6
    if (taskNum === 6) {
      const cardA = document.getElementById('dilemma-card-a');
      const cardB = document.getElementById('dilemma-card-b');
      const radA = document.getElementById('radio-dilemma-a');
      const radB = document.getElementById('radio-dilemma-b');

      if (cardA && cardB) {
        cardA.addEventListener('click', () => {
          this.taskSelections[6] = 'A';
          cardA.classList.add('selected');
          cardB.classList.remove('selected');
          radA.checked = true;
        });
        cardB.addEventListener('click', () => {
          this.taskSelections[6] = 'B';
          cardB.classList.add('selected');
          cardA.classList.remove('selected');
          radB.checked = true;
        });
      }
    }
  }

  setupZoomableImages() {
    const images = document.querySelectorAll('.zoomable-img');
    images.forEach(img => {
      img.addEventListener('error', () => {
        const title = img.getAttribute('data-caption') || img.alt || 'CELPIP Visual Scene';
        img.src = this.getSvgFallback(title);
      });
      img.addEventListener('click', () => {
        this.modalImg.src = img.src;
        this.modalCaption.textContent = img.getAttribute('data-caption') || img.alt || '';
        this.imageModal.classList.remove('hidden');
      });
    });
  }

  getSvgFallback(title) {
    const safeTitle = (title || 'CELPIP Visual Scene').replace(/[<>&"]/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect x="350" y="150" width="100" height="75" rx="8" fill="none" stroke="#60a5fa" stroke-width="4"/>
      <circle cx="380" cy="175" r="8" fill="#38bdf8"/>
      <path d="M360 215 L390 190 L410 205 L430 185 L445 215" fill="none" stroke="#93c5fd" stroke-width="3"/>
      <text x="400" y="280" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">${safeTitle}</text>
      <text x="400" y="315" font-family="sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">Official CELPIP Visual Scene Prompt</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // Toast Notification
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 2000);
  }

  // Results Dashboard
  renderResultsDashboard() {
    const container = document.getElementById('results-tasks-container');
    container.innerHTML = '';

    const allRecordings = this.audioEngine.getAllRecordings();

    this.sessionQuestions.forEach((item, idx) => {
      const taskNum = item.taskNumber;
      const rec = allRecordings[taskNum];
      const transcriptData = this.speechAnalyzer.getTranscript(taskNum);

      const card = document.createElement('div');
      card.className = 'result-task-card';

      let audioPlayerHtml = '';
      if (rec && rec.url) {
        audioPlayerHtml = `
          <div class="audio-player-row">
            <audio controls src="${rec.url}" class="task-audio-player"></audio>
            <button class="btn btn-sm btn-outline-primary download-task-btn" data-task="${taskNum}">
              ⬇️ Download Recording
            </button>
          </div>
        `;
      } else {
        audioPlayerHtml = `
          <div class="no-audio-notice">
            ⚠️ No audio recorded for this task. (Microphone was muted or unavailable)
          </div>
        `;
      }

      let transcriptHtml = '';
      if (transcriptData && transcriptData.text) {
        transcriptHtml = `
          <div class="transcript-box">
            <div class="transcript-header">
              <span>Speech-to-Text Transcript</span>
              <span class="transcript-stats">
                <strong>${transcriptData.wordCount}</strong> words | 
                <strong>${transcriptData.wordsPerMinute}</strong> WPM | 
                Fillers: <strong>${transcriptData.fillerCount}</strong>
              </span>
            </div>
            <p class="transcript-text">"${transcriptData.text}"</p>
            ${transcriptData.detectedFillers && transcriptData.detectedFillers.length > 0 ? `
              <div class="filler-chips">
                Detected Fillers: 
                ${transcriptData.detectedFillers.map(f => `<span class="filler-chip">${f.word} (${f.count})</span>`).join(' ')}
              </div>
            ` : ''}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="result-card-header">
          <div>
            <h3>Task ${taskNum}: ${item.taskMeta.title}</h3>
            <span class="result-formula-badge">${item.taskMeta.formula}</span>
          </div>
          <button class="btn btn-sm btn-secondary retry-task-btn" data-task-idx="${idx}">
            🔄 Practice This Task Again
          </button>
        </div>
        <p class="result-prompt-summary"><strong>Prompt:</strong> ${item.question.title} - ${item.question.prompt}</p>
        ${audioPlayerHtml}
        ${transcriptHtml}
      `;

      container.appendChild(card);
    });

    // Bind individual download buttons
    container.querySelectorAll('.download-task-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskNum = parseInt(e.target.getAttribute('data-task'), 10);
        this.audioEngine.downloadRecording(taskNum);
      });
    });

    // Bind individual retry buttons
    container.querySelectorAll('.retry-task-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskIdx = parseInt(e.target.getAttribute('data-task-idx'), 10);
        this.mode = 'practice';
        this.showExamView();
        this.loadTask(taskIdx);
      });
    });
  }

  // Download all recordings sequentially
  downloadAllAudio() {
    const all = this.audioEngine.getAllRecordings();
    const taskKeys = Object.keys(all);
    if (!taskKeys.length) {
      alert('No recordings found to download.');
      return;
    }

    taskKeys.forEach((taskId, index) => {
      setTimeout(() => {
        this.audioEngine.downloadRecording(taskId);
      }, index * 400);
    });
  }
}

// Instantiate on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  window.celpipApp = new CelpipApp();
});
