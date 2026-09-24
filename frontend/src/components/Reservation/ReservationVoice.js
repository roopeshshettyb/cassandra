import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import MicOffIcon from '@mui/icons-material/MicOff';
import { io } from 'socket.io-client';
// Shared with the concierge's voice hook: PCM encoding and chunk scheduling are
// the same facts in both places, so they live in one file.
import { floatTo16BitPCM, arrayBufferToBase64, base64ToUint8Array, playPcmChunk, watchPlaybackEnd } from '../AvatarChatbot/utils/audio';
import { NAVY, MUTED } from '../../theme';
// The same control the in-stay concierge uses. Different socket, different
// rules, but to whoever is talking it is the same assistant.
import { VoiceMicButton } from '../AvatarChatbot/ui/VoiceMic';
import ChatBubble from '../AvatarChatbot/ui/ChatBubble';
import constants from '../../constants.json';

const getBackendUrl = () => (process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

/** Browser mic and the server both work in 24kHz mono 16-bit PCM. */
const SAMPLE_RATE = 24000;

/**
 * Comfort noise — the faint life a real call always carries.
 *
 * Real calls are never silent, and dead silence between sentences is the
 * clearest tell that a voice is synthetic. This runs continuously for the whole
 * call, not just under the agent's speech: noise that appeared and vanished with
 * the voice would be a worse tell than none at all.
 *
 * The bed is a recording of a real room. Nothing is synthesised as a stand-in:
 * generated noise is steady by definition, and a bed that never changes stops
 * sounding like a room and starts sounding like a hiss — which is the thing it
 * was meant to hide. If the recording cannot be fetched the call runs dry.
 */

/** Scale samples in place so their RMS sits at the configured level. */
function normaliseToDbfs(data, dbfs) {
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i];
  const rms = Math.sqrt(sum / data.length);
  if (!rms) return false;
  const scale = Math.pow(10, dbfs / 20) / rms;
  for (let i = 0; i < data.length; i += 1) data[i] *= scale;
  return true;
}

/** Seconds dropped from each end of the recording, and the length of the join. */
const AMBIENCE_GUARD_SECONDS = 0.15;
const AMBIENCE_CROSSFADE_SECONDS = 2;

/**
 * Turn the decoded recording into something that loops without a seam.
 *
 * The guard comes off first: an encoder can leave a few milliseconds of priming
 * silence at either end, and a gap in continuous room tone is far more audible
 * than the tone itself. Then the tail is folded back over the head, so the last
 * two seconds fade into the first two and the join has nothing to hear.
 */
function toLoopBuffer(ctx, decoded) {
  const rate = decoded.sampleRate;
  const guard = Math.round(AMBIENCE_GUARD_SECONDS * rate);
  const fade = Math.round(AMBIENCE_CROSSFADE_SECONDS * rate);
  const usable = decoded.length - guard * 2;
  if (usable <= fade * 2) return null;

  const src = decoded.getChannelData(0);
  const length = usable - fade;
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = src[guard + i];
  for (let j = 0; j < fade; j += 1) {
    const t = j / fade;
    data[j] = data[j] * t + src[guard + length + j] * (1 - t);
  }
  return buffer;
}

/** Open the line with a freshly built buffer, levelled to the configured dBFS. */
function startAmbience(ctx, buffer, dbfs) {
  if (!ctx || !buffer || !dbfs || dbfs <= -100) return null;
  if (!normaliseToDbfs(buffer.getChannelData(0), dbfs)) return null;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = ctx.createGain();
  // Ramped rather than switched on, so the line "opens" instead of clicking.
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.4);
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  return { source, gain };
}

function stopAmbience(ambience, ctx) {
  if (!ambience) return;
  try {
    if (ctx) {
      ambience.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    }
    ambience.source.stop(ctx ? ctx.currentTime + 0.35 : undefined);
  } catch {
    // already stopped
  }
}

/**
 * Public voice reservation. Streams mic audio to the unauthenticated
 * /reservation-voice gateway and plays the spoken reply back.
 *
 * Self-contained: shares no code with the signed-in concierge's voice hook, so
 * nothing here can affect a guest's call.
 */
export default function ReservationVoice({ hotelId, onHotelResolved, onFatalError, alertError }) {
  const [status, setStatus] = useState('connecting'); // connecting | idle | listening | thinking | speaking
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [ended, setEnded] = useState(false);
  // Why the call could not start, shown in place of the mic.
  const [blocked, setBlocked] = useState('');

  const socketRef = useRef(null);
  const micStreamRef = useRef(null);
  const micContextRef = useRef(null);
  const processorRef = useRef(null);
  const playbackContextRef = useRef(null);
  const playbackTimeRef = useRef(0);
  const silenceTimerRef = useRef(null);
  const ambienceRef = useRef(null);
  const ambienceDataRef = useRef(null);
  const stopMicRef = useRef(null);
  // The microphone stays acquired for the whole call and is opened and closed in
  // software. Tearing the hardware down between turns left a deaf window exactly
  // where a person starts their next sentence, and getUserMedia is slow enough
  // that several attempts in a row could be swallowed.
  const micGateRef = useRef(false);
  // Invalidates a start that is still awaiting getUserMedia, so a second tap
  // cannot leave two capture chains attached to one session.
  const startGenRef = useRef(0);
  const startListeningRef = useRef(null);
  // A real call does not ask you to press anything between sentences. The
  // mic reopens itself after each reply until the caller stops it or hangs up.
  const hasInteractedRef = useRef(false);
  const userStoppedRef = useRef(false);
  const endedRef = useRef(false);
  const restartTimerRef = useRef(null);
  const cancelWatchRef = useRef(null);
  const readyRef = useRef(false);

  const hotelIdRef = useRef(hotelId);
  const storageKeyRef = useRef(`${constants.RESERVATION_SESSION_STORAGE_KEY_PREFIX}${hotelId}`);
  const alertErrorRef = useRef(alertError);
  alertErrorRef.current = alertError;
  const onHotelResolvedRef = useRef(onHotelResolved);
  onHotelResolvedRef.current = onHotelResolved;
  const onFatalErrorRef = useRef(onFatalError);
  onFatalErrorRef.current = onFatalError;

  const cancelPlaybackWatch = useCallback(() => {
    cancelWatchRef.current?.();
    cancelWatchRef.current = null;
  }, []);

  const stopMic = useCallback(() => {
    startGenRef.current += 1;
    micGateRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micContextRef.current) {
      micContextRef.current.close().catch(() => {});
      micContextRef.current = null;
    }
  }, []);

  useEffect(() => {
    const url = getBackendUrl();
    if (!url) return undefined;

    // Plain fetch, not api.js: a static file from our own public folder, with
    // nothing to authenticate, no loader to drive and no message to surface.
    // Fetched here so the network round trip is over before the mic is tapped.
    // The room tone, loaded while the page settles so the network is not in the
    // way when the caller taps the mic. The constant overrides it for a property
    // that hosts its own recording; empty means the one shipped with the app,
    // which travels inside a JS chunk because the deploy drops audio files.
    const ambienceUrl = constants.RESERVATION_VOICE_AMBIENCE_URL;
    const loadAmbience = ambienceUrl
      ? fetch(ambienceUrl).then((res) => (res.ok ? res.arrayBuffer() : null))
      : import('../../assets/hotel-ambience').then((mod) => base64ToUint8Array(mod.default).buffer);
    loadAmbience
      .then((data) => {
        ambienceDataRef.current = data;
      })
      .catch(() => {});

    const query = { hotelId: String(hotelIdRef.current) };
    const saved = localStorage.getItem(storageKeyRef.current);
    if (saved) {
      query.sessionToken = saved;
    }

    const socket = io(`${url}/reservation-voice`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      query,
      reconnection: false,
    });
    socketRef.current = socket;

    socket.on('ready', (payload) => {
      onHotelResolvedRef.current?.(payload?.hotel || null);
      if (payload?.sessionToken) {
        localStorage.setItem(storageKeyRef.current, payload.sessionToken);
      }
    });
    socket.on('session', (payload) => {
      if (payload?.sessionToken) {
        localStorage.setItem(storageKeyRef.current, payload.sessionToken);
      }
    });
    socket.on('voice_ready', () => {
      readyRef.current = true;
      setBlocked('');
      setStatus((prev) => (prev === 'listening' ? prev : 'idle'));
      // The line is ours again: take the next turn without asking the caller to
      // press anything, unless they stopped it or hung up.
      if (!hasInteractedRef.current || userStoppedRef.current || endedRef.current) {
        return;
      }
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        startListeningRef.current?.(true);
      }, constants.RESERVATION_VOICE_TURN_RESTART_GRACE_MS);
    });
    socket.on('voice_user_chunk', (p) => setTranscript(p?.delta || ''));
    // End of speech: the server has closed its STT session, so anything more
    // from the mic is wasted, and an open mic during the reply feeds the agent
    // its own voice. Closing the gate stops the sending; the hardware stays
    // ours, so the next turn starts instantly instead of re-prompting.
    socket.on('voice_turn_end', () => {
      micGateRef.current = false;
      setStatus('thinking');
    });
    socket.on('voice_user_message', (p) => {
      setTranscript(p?.text || '');
      setReply('');
      setStatus('thinking');
    });
    socket.on('voice_text_chunk', (p) => setReply((prev) => prev + (p?.delta || ' ')));
    // The whole reply, once it is written. Authoritative over the chunks
    // above: a reply that never hit a sentence boundary — one short line, or
    // a language whose punctuation the splitter does not know — arrives only
    // here, and the caller would otherwise watch an empty screen talk.
    socket.on('voice_text_end', (p) => {
      if (typeof p?.text === 'string' && p.text.trim()) setReply(p.text.trim());
    });
    socket.on('voice_audio_chunk', (p) => {
      if (!p?.delta) return;
      setStatus('speaking');
      playPcmChunk(p.delta, playbackContextRef, playbackTimeRef);
    });
    // Only the browser knows when sound stopped coming out of the speaker:
    // chunks are scheduled ahead, so the socket going quiet says nothing about
    // playback. Poll the audio clock and report, the way the concierge does —
    // the server holds the turn until then, so the mic never opens under the
    // agent's own voice.
    // Only the browser knows when sound stopped coming out of the speaker, so
    // it measures and reports; the server holds the turn until then. Same
    // watcher the concierge uses.
    socket.on('voice_audio_end', () => {
      // Deliberately not 'idle': the server has sent the last chunk but seconds
      // of it may still be scheduled. voice_ready is the one thing that clears
      // this, which is how the concierge does it too.
      cancelPlaybackWatch();
      cancelWatchRef.current = watchPlaybackEnd(
        playbackContextRef,
        playbackTimeRef.current,
        () => socket.emit('voice_playback_done'),
        constants.VOICE_PLAYBACK_WATCH_GRACE_MS,
      );
    });
    socket.on('voice_call_ended', () => {
      endedRef.current = true;
      clearTimeout(restartTimerRef.current);
      setEnded(true);
      setStatus('idle');
      stopAmbience(ambienceRef.current, playbackContextRef.current);
      ambienceRef.current = null;
    });
    socket.on('error', (p) => {
      // Before the call is live, any error means it never started — show it in
      // place instead of leaving a dead mic under a fading toast.
      setBlocked((prev) => (readyRef.current ? prev : p?.message || ''));
      onFatalErrorRef.current?.(p?.message);
      alertErrorRef.current?.(p?.message);
      setStatus('idle');
    });
    socket.on('disconnect', () => {
      setStatus('idle');
      if (!readyRef.current) {
        setBlocked((prev) => prev || constants.ERROR_RESERVATION_VOICE_FAILED);
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  stopMicRef.current = stopMic;

  useEffect(() => () => {
    clearTimeout(restartTimerRef.current);
    cancelPlaybackWatch();
    stopMic();
    stopAmbience(ambienceRef.current, playbackContextRef.current);
    ambienceRef.current = null;
  }, [stopMic]);

  /** `auto` marks a turn the page opened itself rather than one the caller tapped. */
  const startListening = async (auto = false) => {
    if (!socketRef.current?.connected || endedRef.current) return;
    hasInteractedRef.current = true;
    userStoppedRef.current = false;
    setTranscript('');

    // Already holding the microphone: this turn costs nothing but reopening the
    // gate. No getUserMedia, no new AudioContext, no gap for the caller to talk
    // into and be missed.
    if (processorRef.current && micStreamRef.current) {
      socketRef.current.emit('voice_start');
      micGateRef.current = true;
      setStatus('listening');
      return;
    }

    stopMic();
    setStatus('listening');
    // Ask the server to open its STT socket first: it connects while the browser
    // is still prompting for the mic, so the first word is not clipped.
    socketRef.current.emit('voice_start');
    // Create the playback context now, inside the tap, so it is allowed to make
    // sound later when the reply arrives.
    if (!playbackContextRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      playbackContextRef.current = new AudioCtx({ sampleRate: SAMPLE_RATE });
    }
    if (playbackContextRef.current.state === 'suspended') {
      await playbackContextRef.current.resume();
    }
    // Open the line: the room tone runs from here until the call ends. A fresh
    // buffer every time, because startAmbience levels it in place.
    if (!ambienceRef.current) {
      const ctx = playbackContextRef.current;
      let bed = null;
      if (ambienceDataRef.current) {
        try {
          // slice: decodeAudioData detaches what it is given, and the recording
          // has to survive for the next call.
          bed = toLoopBuffer(ctx, await ctx.decodeAudioData(ambienceDataRef.current.slice(0)));
        } catch {
          bed = null;
        }
      }
      // No bed rather than a generated stand-in. Noise that is merely noise
      // does not read as a room, and having it play when the recording is
      // missing made a broken deploy sound exactly like a working one.
      ambienceRef.current = startAmbience(ctx, bed, constants.RESERVATION_VOICE_AMBIENCE_DBFS);
    }
    const generation = startGenRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextImpl({ sampleRate: SAMPLE_RATE });
      // getUserMedia's await ends the user-gesture window, so this context can
      // come back suspended and never fire onaudioprocess. Resume before wiring.
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      let heardSound = false;
      processor.onaudioprocess = (e) => {
        if (!micGateRef.current || !socketRef.current?.connected) return;
        const input = e.inputBuffer.getChannelData(0);
        if (!heardSound) {
          for (let i = 0; i < input.length; i += 1) {
            if (Math.abs(input[i]) > 0.01) { heardSound = true; break; }
          }
        }
        socketRef.current.emit('voice_client_chunk', { audio: arrayBufferToBase64(floatTo16BitPCM(input).buffer) });
      };
      // A mic that streams pure silence looks identical to a broken pipeline, so
      // say so — but only on a turn the caller asked for. Once the page is
      // reopening the mic itself, silence is just someone thinking, and warning
      // them about their microphone every few seconds is the bug, not the help.
      if (!auto) {
        silenceTimerRef.current = setTimeout(() => {
          if (!heardSound) {
            alertErrorRef.current?.(constants.RESERVATION_VOICE_NO_SOUND);
          }
        }, constants.RESERVATION_VOICE_NO_SOUND_AFTER_MS);
      }
      // A newer start (or a stop) happened while the browser was prompting —
      // drop this one rather than attaching a second capture chain.
      if (generation !== startGenRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
        return;
      }
      source.connect(processor);
      processor.connect(ctx.destination);
      micStreamRef.current = stream;
      micContextRef.current = ctx;
      processorRef.current = processor;
      micGateRef.current = true;
    } catch (err) {
      setStatus('idle');
      // Stop the loop: reopening a mic the browser just refused would retry
      // forever and raise the same alert on every pass.
      userStoppedRef.current = true;
      if (!auto) {
        alertErrorRef.current?.(constants.RESERVATION_VOICE_MIC_DENIED);
      }
    }
  };
  startListeningRef.current = startListening;

  const stopListening = () => {
    userStoppedRef.current = true;
    clearTimeout(restartTimerRef.current);
    stopMic();
    if (socketRef.current?.connected) {
      socketRef.current.emit('voice_stop');
    }
    setStatus('idle');
  };

  const label = {
    connecting: constants.RESERVATION_VOICE_CONNECTING,
    idle: constants.RESERVATION_VOICE_TAP_TO_SPEAK,
    listening: constants.RESERVATION_VOICE_LISTENING,
    thinking: constants.RESERVATION_VOICE_THINKING,
    speaking: constants.RESERVATION_VOICE_SPEAKING,
  }[status];

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, px: 3, py: 4 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: NAVY }}>
          {constants.RESERVATION_VOICE_TITLE}
        </Typography>
        <Typography sx={{ fontSize: 14, color: MUTED, mt: 0.5, maxWidth: 420, lineHeight: 1.6 }}>
          {constants.RESERVATION_VOICE_SUBTITLE}
        </Typography>
      </Box>

      {blocked ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, maxWidth: 420 }}>
          <MicOffIcon sx={{ fontSize: 52, color: MUTED }} />
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: NAVY, textAlign: 'center' }}>{blocked}</Typography>
          <Typography sx={{ fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 1.6 }}>
            {constants.RESERVATION_VOICE_SWITCH_TO_TEXT}
          </Typography>
        </Box>
      ) : (
        <>
          <VoiceMicButton
            active={status === 'listening' || status === 'thinking' || status === 'speaking'}
            disabled={ended || status === 'thinking' || status === 'connecting'}
            onTap={status === 'listening' ? stopListening : () => startListening(false)}
            label={label}
          />
          <Typography sx={{ fontSize: 14, color: MUTED, letterSpacing: '0.04em', textAlign: 'center', fontWeight: 500, minHeight: 20 }}>
            {label}
          </Typography>
        </>
      )}

      {(transcript || reply) && (
        <Box sx={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {transcript && <ChatBubble message={{ role: 'user', content: transcript }} />}
          {reply && <ChatBubble message={{ role: 'assistant', content: reply }} />}
        </Box>
      )}
    </Box>
  );
}
