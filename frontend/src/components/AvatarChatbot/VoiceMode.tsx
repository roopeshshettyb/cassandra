import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Fab } from '@mui/material';
import { useSocketVoice } from './hooks/useSocketVoice';
import { useLipSync } from './hooks/useLipSync';
import { VoiceStatus } from './types';
import { Message } from './types';
import { AvatarCanvasRef } from './AvatarCanvas';
import ChatIcon from '@mui/icons-material/Chat';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';

interface VoiceModeProps {
  onSwitchToChat: () => void;
  isVoiceSupported: boolean;
  bookingId: number;
  parentAvatarRef?: React.RefObject<AvatarCanvasRef | null>;
  addMessage: (message: Message) => void;
}

export const VoiceMode: React.FC<VoiceModeProps> = ({
  onSwitchToChat,
  bookingId,
  parentAvatarRef,
  addMessage,
}) => {
  const [status, setStatus] = useState<VoiceStatus>('idle');

  const { initWithSpeechSynthesis } = useLipSync({
    onLipSyncUpdate: useCallback((value: number) => {
      parentAvatarRef?.current?.setLipSync(value);
    }, [parentAvatarRef]),
    smoothing: 0.5,
  });

  const lipSyncAnim = useRef<ReturnType<typeof initWithSpeechSynthesis>>(null);

  useEffect(() => {
    lipSyncAnim.current = initWithSpeechSynthesis();
    return () => lipSyncAnim.current?.stop();
  }, [initWithSpeechSynthesis]);

  const { isRecording, isSpeaking, startRecording, stopRecording } = useSocketVoice({
    bookingId,
    onUserMessage: (text) => {
      setStatus('processing');
      parentAvatarRef?.current?.playThinking();
      addMessage({
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: new Date()
      });
    },
    onAssistantTextChunk: () => { },
    onAssistantTextEnd: (fullText) => {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullText,
        timestamp: new Date()
      });
    },
    onError: () => setStatus('idle')
  });

  useEffect(() => {
    if (isSpeaking) {
      setStatus('speaking');
      parentAvatarRef?.current?.playTalking();
      lipSyncAnim.current?.start();
    } else if (status === 'speaking') {
      setStatus('idle');
      parentAvatarRef?.current?.playIdle();
      lipSyncAnim.current?.stop();
    }
  }, [isSpeaking, status, parentAvatarRef]);

  useEffect(() => {
    if (isRecording) {
      setStatus('listening');
    } else if (status === 'listening') {
      setStatus('idle');
    }
  }, [isRecording, status]);

  const isActive = isRecording || isSpeaking;

  return (
    <>
      {/* Microphone Button - Bottom Center */}
      <Fab
        onClick={() => isRecording ? stopRecording() : startRecording()}
        sx={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          bgcolor: isActive ? 'rgba(59, 130, 246, 0.3)' : 'rgba(15, 23, 42, 0.8)',
          color: '#60a5fa',
          width: 64,
          height: 64,
          zIndex: 1000,
          boxShadow: isActive
            ? '0 0 40px rgba(59, 130, 246, 0.9)'
            : '0 6px 20px rgba(0, 0, 0, 0.6)',
          '&:hover': { bgcolor: isActive ? 'rgba(59, 130, 246, 0.4)' : 'rgba(37, 99, 235, 0.3)' }
        }}
      >
        <GraphicEqIcon sx={{ fontSize: 36 }} />
      </Fab>
    </>
  );
};
