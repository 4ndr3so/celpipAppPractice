/**
 * CELPIP Audio Recorder & Sound Engine
 * Handles microphone capture, live waveform visualization, audio beeps, and recording exports.
 */

class CelpipAudioEngine {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordings = {}; // Map of taskNumber -> { blob, url, mimeType, duration, recordedAt }
    this.currentTaskId = null;
    this.isRecording = false;
    this.analyser = null;
    this.visualizerAnimationId = null;
    this.supportedMimeType = this.getBestMimeType();
  }

  getBestMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }

  getFileExtension() {
    if (this.supportedMimeType.includes('mp4')) return 'mp4';
    if (this.supportedMimeType.includes('ogg')) return 'ogg';
    if (this.supportedMimeType.includes('wav')) return 'wav';
    return 'webm';
  }

  // Initialize or resume AudioContext
  initAudioContext() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // Play official-style CELPIP alert beeps
  playBeep(type = 'start') {
    try {
      this.initAudioContext();
      if (!this.audioContext) return;

      const now = this.audioContext.currentTime;

      if (type === 'prepWarning') {
        // Soft double chirp 3 seconds before prep ends
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(750, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'start') {
        // Official high beep when recording starts
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now); // A5 note
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === 'stop') {
        // Double lower beep when recording stops
        const osc1 = this.audioContext.createOscillator();
        const gain1 = this.audioContext.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now); // D5
        gain1.gain.setValueAtTime(0.25, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc1.connect(gain1);
        gain1.connect(this.audioContext.destination);
        osc1.start(now);
        osc1.stop(now + 0.2);

        const osc2 = this.audioContext.createOscillator();
        const gain2 = this.audioContext.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(440, now + 0.25); // A4
        gain2.gain.setValueAtTime(0.25, now + 0.25);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc2.connect(gain2);
        gain2.connect(this.audioContext.destination);
        osc2.start(now + 0.25);
        osc2.stop(now + 0.5);
      }
    } catch (err) {
      console.warn('AudioContext beep error:', err);
    }
  }

  // Request microphone permission and warm up stream
  async requestMicPermission() {
    try {
      this.initAudioContext();
      if (!this.mediaStream) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }
      return { success: true };
    } catch (err) {
      console.error('Microphone access denied or unavailable:', err);
      return {
        success: false,
        error: err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Please allow microphone access in your browser to record your answers.'
          : 'Could not access microphone: ' + err.message
      };
    }
  }

  // Attach live mic meter for audio testing on setup screen
  setupMicMeter(meterElement, canvasElement) {
    if (!this.mediaStream) return;
    this.initAudioContext();

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    const meterAnalyser = this.audioContext.createAnalyser();
    meterAnalyser.fftSize = 256;
    source.connect(meterAnalyser);

    const bufferLength = meterAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateMeter = () => {
      if (!this.mediaStream || !this.mediaStream.active) return;
      meterAnalyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const percent = Math.min(100, Math.round((average / 128) * 100));

      if (meterElement) {
        meterElement.style.width = percent + '%';
        if (percent > 65) {
          meterElement.style.backgroundColor = '#ef4444';
        } else if (percent > 20) {
          meterElement.style.backgroundColor = '#10b981';
        } else {
          meterElement.style.backgroundColor = '#f59e0b';
        }
      }

      if (canvasElement) {
        this.drawWaveform(canvasElement, meterAnalyser);
      }

      requestAnimationFrame(updateMeter);
    };

    updateMeter();
  }

  // Start recording for a specific task
  async startRecording(taskId, canvasElement = null) {
    if (this.isRecording) {
      await this.stopRecording();
    }

    const micRes = await this.requestMicPermission();
    if (!micRes.success) {
      throw new Error(micRes.error);
    }

    this.currentTaskId = taskId;
    this.recordedChunks = [];
    this.isRecording = true;

    const options = this.supportedMimeType ? { mimeType: this.supportedMimeType } : {};
    this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250); // Slice data every 250ms
    this.playBeep('start');

    // Connect visualizer
    if (canvasElement) {
      this.startVisualizer(canvasElement);
    }

    return true;
  }

  // Stop current recording and return the saved recording object
  stopRecording() {
    return new Promise((resolve) => {
      if (!this.isRecording || !this.mediaRecorder) {
        this.stopVisualizer();
        resolve(null);
        return;
      }

      this.isRecording = false;
      this.playBeep('stop');

      this.mediaRecorder.onstop = () => {
        this.stopVisualizer();
        const mimeType = this.mediaRecorder.mimeType || this.supportedMimeType || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const recordingData = {
          taskId: this.currentTaskId,
          blob: blob,
          url: url,
          mimeType: mimeType,
          sizeBytes: blob.size,
          recordedAt: new Date().toLocaleTimeString()
        };

        this.recordings[this.currentTaskId] = recordingData;
        resolve(recordingData);
      };

      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        } else {
          resolve(null);
        }
      } catch (err) {
        console.warn('Error stopping mediaRecorder:', err);
        resolve(null);
      }
    });
  }

  // Visualizer on Canvas
  startVisualizer(canvas) {
    this.stopVisualizer();
    if (!this.mediaStream || !canvas) return;

    this.initAudioContext();
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    const canvasCtx = canvas.getContext('2d');
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this.visualizerAnimationId = requestAnimationFrame(draw);
      this.analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      canvasCtx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;

        // Gradient color from vibrant blue to emerald green
        const r = 37 + (dataArray[i] / 255) * 40;
        const g = 99 + (dataArray[i] / 255) * 100;
        const b = 235 - (dataArray[i] / 255) * 50;

        canvasCtx.fillStyle = `rgb(${r},${g},${b})`;
        canvasCtx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

        x += barWidth;
      }
    };

    draw();
  }

  stopVisualizer() {
    if (this.visualizerAnimationId) {
      cancelAnimationFrame(this.visualizerAnimationId);
      this.visualizerAnimationId = null;
    }
  }

  drawWaveform(canvas, customAnalyser) {
    const canvasCtx = canvas.getContext('2d');
    const bufferLength = customAnalyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    customAnalyser.getByteTimeDomainData(dataArray);

    const width = canvas.width;
    const height = canvas.height;
    canvasCtx.fillStyle = '#0f172a';
    canvasCtx.fillRect(0, 0, width, height);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#38bdf8';
    canvasCtx.beginPath();

    const sliceWidth = width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * height / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();
  }

  // Get recording for a task
  getRecording(taskId) {
    return this.recordings[taskId] || null;
  }

  // Get all saved recordings
  getAllRecordings() {
    return this.recordings;
  }

  // Download a single recording file
  downloadRecording(taskId, filename = null) {
    const rec = this.recordings[taskId];
    if (!rec) return false;

    const ext = this.getFileExtension();
    const finalFilename = filename || `CELPIP_Task_${taskId}_Recording.${ext}`;
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = rec.url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
    return true;
  }

  // Release microphone and clean up
  cleanup() {
    this.stopVisualizer();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Make available globally
window.CelpipAudioEngine = CelpipAudioEngine;
