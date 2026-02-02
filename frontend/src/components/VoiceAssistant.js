import React, { useState, useRef, useEffect } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Mic, MicOff } from '@mui/icons-material';
import { motion } from 'framer-motion';
import io from 'socket.io-client';

const MotionBox = motion(Box);

function VoiceAssistant({ sessionId }) {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('Ready');
  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const processorRef = useRef(null);
  const playbackContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);

  useEffect(() => {
    // Initialize playback audio context once
    playbackContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });

    // Connect to backend WebSocket
    socketRef.current = io(process.env.REACT_APP_BACKEND_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to voice server');
    });

    socketRef.current.on('session-started', () => {
      setStatus('Session started');
    });

    socketRef.current.on('openai-message', (message) => {
      // Handle audio response
      if (message.type === 'response.audio.delta' && message.delta) {
        queueAudio(message.delta);
      }

      if (message.type === 'response.done') {
        setStatus('Ready');
      }
    });

    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error);
      setStatus('Error occurred');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (playbackContextRef.current) {
        playbackContextRef.current.close();
      }
      stopListening();
    };
  }, []);

  const queueAudio = (base64Audio) => {
    audioQueueRef.current.push(base64Audio);
    if (!isPlayingRef.current) {
      playNextAudio();
    }
  };

  const playNextAudio = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const base64Audio = audioQueueRef.current.shift();

    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);

      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);
      }

      const audioBuffer = playbackContextRef.current.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = playbackContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(playbackContextRef.current.destination);

      // Schedule playback
      const currentTime = playbackContextRef.current.currentTime;
      const startTime = Math.max(currentTime, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      source.onended = () => {
        playNextAudio();
      };
    } catch (error) {
      console.error('Error playing audio:', error);
      playNextAudio();
    }
  };

  const startListening = async () => {
    try {
      setIsListening(true);
      setStatus('Listening...');

      // Reset audio queue and playback state
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      nextPlayTimeRef.current = 0;

      // Start session with shared sessionId
      socketRef.current.emit('start-session', { sessionId });

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Create audio context for recording
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);

      // Create processor for audio data
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = convertToPCM16(inputData);
        const base64Audio = arrayBufferToBase64(pcm16);

        socketRef.current.emit('audio-data', base64Audio);
      };

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);
    } catch (error) {
      console.error('Error starting voice:', error);
      setStatus('Microphone access denied');
      setIsListening(false);
    }
  };

  const stopListening = () => {
    setIsListening(false);
    setStatus('Processing...');

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.emit('commit-audio');
    }
  };

  const convertToPCM16 = (float32Array) => {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm16.buffer;
  };

  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  return (
    <MotionBox
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        p: 3,
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: 3,
      }}
    >
      <Typography variant="h5" gutterBottom>
        Talk to Cassandra
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {status}
      </Typography>

      <IconButton
        onClick={isListening ? stopListening : startListening}
        sx={{
          width: 80,
          height: 80,
          bgcolor: isListening ? 'error.main' : 'primary.main',
          color: 'white',
          '&:hover': {
            bgcolor: isListening ? 'error.dark' : 'primary.dark',
          },
          transition: 'all 0.3s ease',
        }}
      >
        {isListening ? <MicOff sx={{ fontSize: 40 }} /> : <Mic sx={{ fontSize: 40 }} />}
      </IconButton>

      <Typography variant="caption" color="text.secondary">
        {isListening ? 'Click to stop' : 'Click to talk'}
      </Typography>
    </MotionBox>
  );
}

export default VoiceAssistant;
