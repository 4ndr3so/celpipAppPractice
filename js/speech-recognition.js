/**
 * CELPIP Live Speech-to-Text & Fluency Analyzer
 * Uses Web Speech API for optional real-time transcription and fluency metrics.
 */

class CelpipSpeechAnalyzer {
  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.isSupported = !!SpeechRecognition;
    this.recognition = null;
    this.transcripts = {}; // Map of taskId -> { text, wordCount, wpm, fillers }
    this.currentTaskId = null;
    this.startTime = null;
    this.interimTranscript = '';
    this.finalTranscript = '';
    this.onUpdateCallback = null;

    if (this.isSupported) {
      this.initRecognition(SpeechRecognition);
    }
  }

  initRecognition(SpeechRecognition) {
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          this.finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      this.interimTranscript = interim;

      if (this.onUpdateCallback) {
        this.onUpdateCallback({
          final: this.finalTranscript,
          interim: this.interimTranscript,
          combined: (this.finalTranscript + ' ' + this.interimTranscript).trim()
        });
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('Speech recognition notice:', event.error);
    };

    this.recognition.onend = () => {
      // Auto-restart if we are still analyzing this task
      if (this.isListening) {
        try {
          this.recognition.start();
        } catch (e) {
          // Ignore restart collisions
        }
      }
    };
  }

  startListening(taskId, onUpdate = null) {
    if (!this.isSupported) return false;

    this.currentTaskId = taskId;
    this.finalTranscript = '';
    this.interimTranscript = '';
    this.startTime = Date.now();
    this.isListening = true;
    this.onUpdateCallback = onUpdate;

    try {
      this.recognition.start();
      return true;
    } catch (err) {
      console.warn('Speech recognition start issue:', err);
      return false;
    }
  }

  stopListening() {
    if (!this.isSupported || !this.isListening) return null;

    this.isListening = false;
    try {
      this.recognition.stop();
    } catch (err) {
      // Ignore
    }

    const durationSeconds = Math.max(1, (Date.now() - (this.startTime || Date.now())) / 1000);
    const completeText = (this.finalTranscript + ' ' + this.interimTranscript).trim();

    // Analyze text metrics
    const analysis = this.analyzeText(completeText, durationSeconds);
    this.transcripts[this.currentTaskId] = {
      text: completeText,
      durationSeconds: Math.round(durationSeconds),
      ...analysis
    };

    return this.transcripts[this.currentTaskId];
  }

  analyzeText(text, durationSeconds) {
    if (!text || text.trim() === '') {
      return {
        wordCount: 0,
        wordsPerMinute: 0,
        fillerCount: 0,
        detectedFillers: [],
        cohesionScore: 'N/A'
      };
    }

    const words = text.toLowerCase().match(/\b[a-z0-9']+\b/g) || [];
    const wordCount = words.length;
    const wpm = Math.round((wordCount / durationSeconds) * 60);

    // Common filler words
    const fillerList = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'sort of', 'kind of', 'i mean'];
    const detectedFillers = [];
    let fillerCount = 0;

    const lowerText = text.toLowerCase();
    for (const filler of fillerList) {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        fillerCount += matches.length;
        detectedFillers.push({ word: filler, count: matches.length });
      }
    }

    return {
      wordCount,
      wordsPerMinute: wpm,
      fillerCount,
      detectedFillers
    };
  }

  getTranscript(taskId) {
    return this.transcripts[taskId] || null;
  }
}

// Make available globally
window.CelpipSpeechAnalyzer = CelpipSpeechAnalyzer;
