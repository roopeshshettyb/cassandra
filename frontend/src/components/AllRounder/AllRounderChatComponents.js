import React from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BORDER, SHADOW, BRAND_GRADIENT, PRIMARY_CONTRAST, MUTED, NAVY_CONTRAST } from '../../theme';
import AgentCardRenderer from './AgentCardRenderer';
import constants from '../../constants.json';

export function getDateLabel(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DateSeparator({ label }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 0.5 }}>
      <Box sx={{ flex: 1, height: '1px', bgcolor: BORDER }} />
      <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: BORDER }} />
    </Box>
  );
}

export function ChatBubble({ message, navigate }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '84%', display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      {!isUser && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 18, height: 18, borderRadius: 1, background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <SmartToyIcon sx={{ fontSize: 11, color: PRIMARY_CONTRAST }} />
          </Box>
          <Typography sx={{ fontSize: 10, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {constants.AI_ASSISTANT_TITLE}
          </Typography>
        </Box>
      )}
      <Box sx={{
        px: 1.75, py: 1,
        borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
        background: isUser ? BRAND_GRADIENT : 'background.paper',
        border: isUser ? 'none' : `1px solid ${BORDER}`,
        boxShadow: SHADOW,
        color: isUser ? PRIMARY_CONTRAST : 'text.primary',
        fontSize: 13.5, lineHeight: 1.55,
        '& p': { m: 0 }, '& ul, & ol': { m: 0, pl: 2 }, '& li': { mt: 0.3 },
        '& code': { fontFamily: 'monospace', fontSize: 11.5 }, '& strong': { fontWeight: 700 },
      }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
      </Box>
      {message.cards?.length > 0 && <AgentCardRenderer cards={message.cards} navigate={navigate} />}
    </motion.div>
  );
}

export function ThinkingBubble() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, alignSelf: 'flex-start' }}>
      <Box sx={{ width: 18, height: 18, borderRadius: 1, background: BRAND_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SmartToyIcon sx={{ fontSize: 11, color: PRIMARY_CONTRAST }} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 1, borderRadius: '4px 14px 14px 14px', border: `1px solid ${BORDER}`, bgcolor: 'background.paper', boxShadow: SHADOW }}>
        {[0, 1, 2].map((i) => (
          <motion.div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: MUTED }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </Box>
    </Box>
  );
}

export function buildMessageList(messages) {
  const result = [];
  let lastDateLabel = null;
  for (const msg of messages) {
    const dateLabel = getDateLabel(msg.createdAt);
    if (dateLabel && dateLabel !== lastDateLabel) {
      result.push({ type: 'separator', label: dateLabel, key: `sep-${dateLabel}-${msg.id}` });
      lastDateLabel = dateLabel;
    }
    result.push({ type: 'message', msg, key: String(msg.id) });
  }
  return result;
}

export function extractCardsFromToolCalls(toolCalls) {
  if (!toolCalls?.length) return [];
  const cards = [];
  for (const tc of toolCalls) {
    if (!tc.output) continue;
    let parsed;
    try { parsed = typeof tc.output === 'string' ? JSON.parse(tc.output) : tc.output; } catch { continue; }
    const items = Array.isArray(parsed) ? parsed : parsed?.stats ? parsed.stats : [];
    for (const item of items) {
      if (!item._card_type) continue;
      if (item._card_type === 'request') {
        const roomPart = item.roomNumber ? ` · Room ${item.roomNumber}` : '';
        cards.push({ type: 'request', title: `${String(item.requestType ?? '').replace(/_/g, ' ')} — ${item.guestName ?? 'Guest'}`, subtitle: `${item.hotelName ?? ''}${roomPart}` || undefined, badge: item.urgency, route: `/requests/${item.id}`, meta: { status: item.status, urgency: item.urgency } });
      } else if (item._card_type === 'booking') {
        const checkIn = item.startTime ? new Date(item.startTime).toLocaleDateString() : '';
        cards.push({ type: 'booking', title: item.guestName ?? `Room ${item.roomNumber}`, subtitle: `Room ${item.roomNumber} · ${checkIn}`, route: `/bookings/${item.id}`, meta: {} });
      } else if (item._card_type === 'hotel') {
        cards.push({ type: 'hotel', title: item.name, subtitle: item.address, route: `/hotels/${item.id}`, meta: {} });
      } else if (item._card_type === 'stat') {
        cards.push({ type: 'stat', title: String(item.value ?? ''), subtitle: item.label, meta: {} });
      }
    }
  }
  return cards;
}

// Auto-scroll helper: always scrolls to bottom on new messages
export function useAutoScroll(scrollRef, deps) {
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, deps); // eslint-disable-line
}

export function WaveformBars() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: 28 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div key={i}
          style={{ width: 4, height: 20, borderRadius: 99, background: NAVY_CONTRAST, originY: 0.5 }}
          animate={{ scaleY: [0.4, 1.5, 0.4] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
        />
      ))}
    </Box>
  );
}

export function mapDbMessages(dbMessages) {
  const loaded = [];
  for (const m of (dbMessages || [])) {
    loaded.push({ role: m.role, content: m.content, cards: extractCardsFromToolCalls(m.toolCalls), id: m.id, createdAt: m.createdAt });
  }
  return loaded;
}
