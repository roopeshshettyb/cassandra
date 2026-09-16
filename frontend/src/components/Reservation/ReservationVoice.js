import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import MicOffIcon from '@mui/icons-material/MicOff';
import { io } from 'socket.io-client';
// Shared with the concierge's voice hook: PCM encoding and chunk scheduling are
// the same facts in both places, so they live in one file.
import { floatTo16BitPCM, arrayBufferToBase64, playPcmChunk } from '../AvatarChatbot/utils/audio';
import { NAVY, MUTED, BRAND_GRADIENT, PRIMARY_CONTRAST, BORDER, SHADOW } from '../../theme';
import constants from '../../constants.json';
// Imported rather than fetched from /public: webpack emits it under
// static/, alongside the bundle that needs it, so it cannot be deployed
// without the code that plays it — which is exactly how stage ended up
// running this page with the asset missing and the fallback hiss on.
import bundledAmbience from '../../assets/hotel-ambience.m4a';

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

function Orb({ status }) {
  const listening = status === 'listening';
  const speaking = status === 'speaking';
  return (
    <Box
      component={motion.div}
      animate={{ scale: listening || speaking ? [1, 1.08, 1] : 1 }}
      transition={{ duration: 1.4, repeat: listening || speaking ? Infinity : 0, ease: 'easeInOut' }}
      sx={{
        width: 148,
        height: 148,
        borderRadius: '50%',
        background: BRAND_GRADIENT,
        color: PRIMARY_CONTRAST,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 18px 44px rgba(0,0,0,0.16)',
      }}
    >
      {status === 'thinking' ? (
        <CircularProgress size={40} sx={{ color: PRIMARY_CONTRAST }} />
      ) : listening ? (
        <StopIcon sx={{ fontSize: 58 }} />
      ) : (
        <MicIcon sx={{ fontSize: 58 }} />
      )}
    </Box>
  );
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
  const readyRef = useRef(false);

  const hotelIdRef = useRef(hotelId);
  const storageKeyRef = useRef(`${constants.RESERVATION_SESSION_STORAGE_KEY_PREFIX}${hotelId}`);
  const alertErrorRef = useRef(alertError);
  alertErrorRef.current = alertError;
  const onHotelResolvedRef = useRef(onHotelResolved);
  onHotelResolvedRef.current = onHotelResolved;
  const onFatalErrorRef = useRef(onFatalError);
  onFatalErrorRef.current = onFatalError;

  const stopMic = useCallback(() => {
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
    // The constant is an override for a property that wants its own recording;
    // empty means the one shipped with the app.
    const ambienceUrl = constants.RESERVATION_VOICE_AMBIENCE_URL || bundledAmbience;
    if (ambienceUrl) {
      fetch(ambienceUrl)
        .then((res) => (res.ok ? res.arrayBuffer() : null))
        .then((data) => {
          ambienceDataRef.current = data;
        })
        .catch(() => {});
    }

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
    });
    socket.on('voice_user_chunk', (p) => setTranscript(p?.delta || ''));
    // End of speech: the server has closed its STT session, so anything more
    // from the mic is wasted — and an open mic during the reply just feeds the
    // agent's own voice back in.
    socket.on('voice_turn_end', () => {
      stopMicRef.current?.();
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
    socket.on('voice_audio_end', () => setStatus('idle'));
    socket.on('voice_call_ended', () => {
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
    stopMic();
    stopAmbience(ambienceRef.current, playbackContextRef.current);
    ambienceRef.current = null;
  }, [stopMic]);

  const startListening = async () => {
    if (!socketRef.current?.connected || ended) return;
    // Tear down any capture still running before opening another. Without this a
    // second tap left the first ScriptProcessor attached and streaming, so the
    // server received two interleaved copies of the caller and STT could make
    // nothing of either — the mic looked dead from the second turn onwards.
    stopMic();
    setStatus('listening');
    setTranscript('');
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
        if (!socketRef.current?.connected) return;
        const input = e.inputBuffer.getChannelData(0);
        if (!heardSound) {
          for (let i = 0; i < input.length; i += 1) {
            if (Math.abs(input[i]) > 0.01) { heardSound = true; break; }
          }
        }
        socketRef.current.emit('voice_client_chunk', { audio: arrayBufferToBase64(floatTo16BitPCM(input).buffer) });
      };
      // A mic that streams pure silence looks identical to a broken pipeline;
      // tell the caller rather than leaving them tapping.
      silenceTimerRef.current = setTimeout(() => {
        if (!heardSound) {
          alertErrorRef.current?.(constants.RESERVATION_VOICE_NO_SOUND);
        }
      }, 6000);
      source.connect(processor);
      processor.connect(ctx.destination);
      micStreamRef.current = stream;
      micContextRef.current = ctx;
      processorRef.current = processor;
    } catch (err) {
      setStatus('idle');
      alertErrorRef.current?.(constants.RESERVATION_VOICE_MIC_DENIED);
    }
  };

  const stopListening = () => {
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
      <Typography sx={{ fontWeight: 800, fontSize: { xs: 24, md: 30 }, color: NAVY, textAlign: 'center' }}>
        {constants.RESERVATION_VOICE_TITLE}
      </Typography>
      <Typography sx={{ fontSize: 14, color: MUTED, textAlign: 'center', maxWidth: 420, lineHeight: 1.6 }}>
        {constants.RESERVATION_VOICE_SUBTITLE}
      </Typography>

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
          <Box
            component="button"
            onClick={status === 'listening' ? stopListening : startListening}
            disabled={ended || status === 'thinking' || status === 'connecting'}
            aria-label={label}
            sx={{ border: 'none', background: 'none', p: 0, cursor: ended ? 'default' : 'pointer', opacity: ended ? 0.4 : 1 }}
          >
            <Orb status={status} />
          </Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: MUTED, minHeight: 20 }}>{label}</Typography>
        </>
      )}

      {(transcript || reply) && (
        <Box sx={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {transcript && (
            <Box sx={{ alignSelf: 'flex-end', maxWidth: '85%', px: 2, py: 1.1, borderRadius: '16px 16px 4px 16px', background: BRAND_GRADIENT, color: PRIMARY_CONTRAST, boxShadow: SHADOW }}>
              <Typography sx={{ fontSize: 14 }}>{transcript}</Typography>
            </Box>
          )}
          {reply && (
            <Box sx={{ alignSelf: 'flex-start', maxWidth: '85%', px: 2, py: 1.1, borderRadius: '16px 16px 16px 4px', bgcolor: 'background.paper', border: `1px solid ${BORDER}`, boxShadow: SHADOW }}>
              <Typography sx={{ fontSize: 14, color: NAVY }}>{reply}</Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
