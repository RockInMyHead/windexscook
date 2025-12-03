import { useState, useRef, useCallback } from 'react';

interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  volume: number;
  mimeType: string;
}

interface UseAudioRecorderProps {
  onRecordingComplete?: (blob: Blob) => void;
  onError?: (error: string) => void;
  onVolumeChange?: (volume: number) => void;
  mimeType?: string;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  sampleRate?: number;
  channelCount?: number;
}

export const useAudioRecorder = ({
  onRecordingComplete,
  onError,
  onVolumeChange,
  mimeType,
  echoCancellation = true,
  noiseSuppression = true,
  autoGainControl = true,
  sampleRate = 44100,
  channelCount = 1
}: UseAudioRecorderProps) => {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    volume: 0,
    mimeType: ''
  });

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const volumeMonitorRef = useRef<number | null>(null);
  const durationTimerRef = useRef<number | null>(null);

  // Supported MIME types in order of preference
  const MIME_TYPES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/wav',
    'audio/mpeg',
    'audio/ogg;codecs=opus',
    'audio/ogg'
  ];

  // Get optimal MIME type for current device
  const getOptimalMimeType = useCallback((): string => {
    if (mimeType) return mimeType;

    // Check user agent for device type
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // iOS Safari has limited codec support
    if (isIOS || isSafari) {
      const iosCompatible = ['audio/mp4', 'audio/wav', 'audio/mpeg'];
      return iosCompatible.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/wav';
    }

    // Android prefers MP4
    if (isAndroid) {
      const androidCompatible = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus'];
      return androidCompatible.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm';
    }

    // Desktop browsers
    return MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm';
  }, [mimeType]);

  // Get audio constraints based on device and settings
  const getAudioConstraints = useCallback((): MediaStreamConstraints => {
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    return {
      audio: {
        echoCancellation,
        noiseSuppression,
        autoGainControl,
        ...(sampleRate && { sampleRate: { ideal: sampleRate } }),
        ...(channelCount && { channelCount: { ideal: channelCount } }),
        // Mobile-specific optimizations
        ...(isMobile && {
          sampleRate: { ideal: 22050 }, // Lower sample rate for mobile
          channelCount: { ideal: 1 }, // Mono audio for mobile
        })
      }
    };
  }, [echoCancellation, noiseSuppression, autoGainControl, sampleRate, channelCount]);

  // Monitor audio volume level
  const startVolumeMonitoring = useCallback((stream: MediaStream) => {
    if (volumeMonitorRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      const monitorVolume = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArrayRef.current);

        // Calculate RMS volume
        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          sum += dataArrayRef.current[i] * dataArrayRef.current[i];
        }
        const rms = Math.sqrt(sum / dataArrayRef.current.length);
        const volumePercent = (rms / 128) * 100; // Normalize to 0-100

        setState(prev => ({ ...prev, volume: volumePercent }));
        onVolumeChange?.(volumePercent);

        volumeMonitorRef.current = requestAnimationFrame(monitorVolume);
      };

      volumeMonitorRef.current = requestAnimationFrame(monitorVolume);
    } catch (error) {
      console.warn('[AudioRecorder] Volume monitoring failed:', error);
    }
  }, [onVolumeChange]);

  // Stop volume monitoring
  const stopVolumeMonitoring = useCallback(() => {
    if (volumeMonitorRef.current) {
      cancelAnimationFrame(volumeMonitorRef.current);
      volumeMonitorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.warn);
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    dataArrayRef.current = null;
  }, []);

  // Update duration timer
  const startDurationTimer = useCallback(() => {
    if (durationTimerRef.current) return;

    startTimeRef.current = Date.now();
    durationTimerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setState(prev => ({ ...prev, duration: elapsed }));
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async (): Promise<void> => {
    try {
      if (state.isRecording) return;

      // Get user media stream
      const constraints = getAudioConstraints();
      console.log('[AudioRecorder] Requesting media stream with constraints:', constraints);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Start volume monitoring
      startVolumeMonitoring(stream);

      // Get optimal MIME type
      const selectedMimeType = getOptimalMimeType();

      // Create MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000 // 128kbps for good quality
      });

      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      // Set up event handlers
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log(`[AudioRecorder] Recorded chunk: ${event.data.size} bytes`);
        }
      };

      recorder.onstart = () => {
        console.log(`[AudioRecorder] ✅ Recording started with MIME type: ${selectedMimeType}`);
        setState(prev => ({
          ...prev,
          isRecording: true,
          isPaused: false,
          mimeType: selectedMimeType
        }));
        startDurationTimer();
      };

      recorder.onstop = async () => {
        console.log('[AudioRecorder] 🛑 Recording stopped');

        const blob = new Blob(recordedChunksRef.current, { type: selectedMimeType });
        console.log(`[AudioRecorder] Created blob: ${blob.size} bytes, type: ${blob.type}`);

        setState(prev => ({ ...prev, isRecording: false, isPaused: false }));
        stopDurationTimer();

        // Call completion callback
        if (blob.size > 0) {
          onRecordingComplete?.(blob);
        }
      };

      recorder.onerror = (event) => {
        const error = event.error?.message || 'Unknown recording error';
        console.error('[AudioRecorder] ❌ Recording error:', error);
        onError?.(error);
        stopRecording();
      };

      // Start recording with time slices
      recorder.start(1000); // 1 second chunks

    } catch (error: any) {
      const errorMessage = error.name === 'NotAllowedError'
        ? 'Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.'
        : error.name === 'NotFoundError'
        ? 'Микрофон не найден. Проверьте подключение микрофона.'
        : `Ошибка доступа к микрофону: ${error.message}`;

      console.error('[AudioRecorder] ❌ Start failed:', error);
      onError?.(errorMessage);

      // Cleanup on error
      stopVolumeMonitoring();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [state.isRecording, getAudioConstraints, getOptimalMimeType, startVolumeMonitoring, startDurationTimer, onRecordingComplete, onError]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || !state.isRecording) {
        resolve(null);
        return;
      }

      console.log('[AudioRecorder] Stopping recording...');

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: state.mimeType || 'audio/webm'
        });
        console.log(`[AudioRecorder] Final blob created: ${blob.size} bytes`);

        setState(prev => ({ ...prev, isRecording: false, isPaused: false }));
        stopDurationTimer();
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  }, [state.isRecording, state.mimeType, stopDurationTimer]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && !state.isPaused) {
      mediaRecorderRef.current.pause();
      setState(prev => ({ ...prev, isPaused: true }));
      console.log('[AudioRecorder] ⏸️ Recording paused');
    }
  }, [state.isRecording, state.isPaused]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording && state.isPaused) {
      mediaRecorderRef.current.resume();
      setState(prev => ({ ...prev, isPaused: false }));
      console.log('[AudioRecorder] ▶️ Recording resumed');
    }
  }, [state.isRecording, state.isPaused]);

  // Cleanup
  const cleanup = useCallback(() => {
    stopRecording();
    stopVolumeMonitoring();
    stopDurationTimer();

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];

    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      volume: 0,
      mimeType: ''
    });
  }, [stopRecording, stopVolumeMonitoring, stopDurationTimer]);

  return {
    // State
    ...state,

    // Methods
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cleanup,

    // Utilities
    getSupportedMimeTypes: () => MIME_TYPES.filter(type => MediaRecorder.isTypeSupported(type)),
    isMediaRecorderSupported: () => typeof MediaRecorder !== 'undefined',
    hasUserMediaSupport: () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  };
};
