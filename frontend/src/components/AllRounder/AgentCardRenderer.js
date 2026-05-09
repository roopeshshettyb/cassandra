import React, { useState } from 'react';
import { Box, Typography, Chip, Divider } from '@mui/material';
import { motion } from 'framer-motion';
import RequestPageIcon from '@mui/icons-material/RequestPage';
import HotelIcon from '@mui/icons-material/Hotel';
import BookOnlineIcon from '@mui/icons-material/BookOnline';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  BORDER, SHADOW, SHADOW_HOVER, MUTED,
  STATUS_WARNING, STATUS_WARNING_BG,
  STATUS_ERROR, STATUS_ERROR_BG,
  STATUS_SUCCESS, STATUS_SUCCESS_BG,
  STATUS_INFO, STATUS_INFO_BG,
  BRAND_GRADIENT, PRIMARY_CONTRAST,
} from '../../theme';

const MAX_LIST = 10;
const CARD_THRESHOLD = 3; // ≤ this → card view; > this → list view

const URGENCY_STYLE = {
  high: { color: STATUS_ERROR, bg: STATUS_ERROR_BG },
  medium: { color: STATUS_WARNING, bg: STATUS_WARNING_BG },
  low: { color: STATUS_SUCCESS, bg: STATUS_SUCCESS_BG },
};
const STATUS_STYLE = {
  pending: { color: STATUS_WARNING, bg: STATUS_WARNING_BG },
  in_progress: { color: STATUS_INFO, bg: STATUS_INFO_BG },
  completed: { color: STATUS_SUCCESS, bg: STATUS_SUCCESS_BG },
};

const TYPE_META = {
  request: { label: 'Request', plural: 'Requests', icon: RequestPageIcon, route: '/requests' },
  hotel: { label: 'Hotel', plural: 'Hotels', icon: HotelIcon, route: '/hotels' },
  booking: { label: 'Booking', plural: 'Bookings', icon: BookOnlineIcon, route: '/bookings' },
};

// ─── Stat grid ────────────────────────────────────────────────────────────────
function StatGrid({ cards }) {
  const [expanded, setExpanded] = useState(false);
  const VISIBLE = 6;
  const shown = expanded ? cards : cards.slice(0, VISIBLE);
  const hasMore = cards.length > VISIBLE;

  return (
    <Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
          gap: 1,
        }}
      >
        {shown.map((card, i) => (
          <Box
            key={i}
            sx={{
              px: 1.5,
              py: 1.25,
              borderRadius: 2,
              border: `1px solid ${BORDER}`,
              boxShadow: SHADOW,
              bgcolor: 'background.paper',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.25,
            }}
          >
            <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: 'primary.main' }}>
              {card.title}
            </Typography>
            <Typography sx={{ fontSize: 10, color: MUTED, textAlign: 'center', fontWeight: 500, lineHeight: 1.3 }}>
              {card.subtitle}
            </Typography>
          </Box>
        ))}
      </Box>
      {hasMore && (
        <Box
          onClick={() => setExpanded((p) => !p)}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75, cursor: 'pointer', width: 'fit-content' }}
        >
          <ExpandMoreIcon
            sx={{
              fontSize: 14,
              color: MUTED,
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(180deg)' : 'none',
            }}
          />
          <Typography sx={{ fontSize: 11, color: MUTED }}>
            {expanded ? 'Show less' : `Show ${cards.length - VISIBLE} more`}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ─── Card view (≤ CARD_THRESHOLD items) ───────────────────────────────────────
function CardView({ cards, navigate }) {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        overflowX: 'auto',
        pb: 0.5,
        '&::-webkit-scrollbar': { height: 4 },
        '&::-webkit-scrollbar-thumb': { borderRadius: 2, background: BORDER },
      }}
    >
      {cards.map((card, i) => {
        const meta = TYPE_META[card.type] || TYPE_META.request;
        const Icon = meta.icon;
        const urgencyStyle = URGENCY_STYLE[card.meta?.urgency] || URGENCY_STYLE.medium;
        const statusStyle = STATUS_STYLE[card.meta?.status] || STATUS_STYLE.pending;
        return (
          <Box
            key={i}
            component={motion.div}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => card.route && navigate(card.route)}
            sx={{
              minWidth: 180,
              maxWidth: 220,
              px: 2,
              py: 1.5,
              borderRadius: 2,
              border: `1px solid ${BORDER}`,
              boxShadow: SHADOW,
              bgcolor: 'background.paper',
              cursor: card.route ? 'pointer' : 'default',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.75,
              flexShrink: 0,
              transition: 'box-shadow 0.2s',
              '&:hover': card.route ? { boxShadow: SHADOW_HOVER } : {},
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Icon sx={{ fontSize: 15, color: MUTED, flexShrink: 0 }} />
              <Typography
                sx={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {card.title}
              </Typography>
            </Box>
            {card.subtitle && (
              <Typography sx={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {card.subtitle}
              </Typography>
            )}
            {(card.badge || card.meta?.status) && (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {card.badge && (
                  <Chip
                    label={card.badge}
                    size="small"
                    sx={{ fontSize: 9, height: 16, bgcolor: urgencyStyle.bg, color: urgencyStyle.color, fontWeight: 700 }}
                  />
                )}
                {card.meta?.status && (
                  <Chip
                    label={String(card.meta.status).replace('_', ' ')}
                    size="small"
                    sx={{ fontSize: 9, height: 16, bgcolor: statusStyle.bg, color: statusStyle.color, fontWeight: 700 }}
                  />
                )}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ─── List view (> CARD_THRESHOLD items) ───────────────────────────────────────
function ListView({ cards, navigate, totalCount, listRoute }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? cards : cards.slice(0, MAX_LIST);
  const hasMore = !expanded && cards.length > MAX_LIST;
  const hasOverflow = totalCount > MAX_LIST;

  return (
    <Box>
      <Box
        sx={{
          border: `1px solid ${BORDER}`,
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: SHADOW,
        }}
      >
        {shown.map((card, i) => {
          const meta = TYPE_META[card.type] || TYPE_META.request;
          const Icon = meta.icon;
          const urgencyStyle = URGENCY_STYLE[card.meta?.urgency] || URGENCY_STYLE.medium;
          const statusStyle = STATUS_STYLE[card.meta?.status] || STATUS_STYLE.pending;
          return (
            <Box key={i}>
              {i > 0 && <Divider />}
              <Box
                component={motion.div}
                whileTap={card.route ? { scale: 0.99 } : undefined}
                onClick={() => card.route && navigate(card.route)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  px: 1.75,
                  py: 1.1,
                  bgcolor: 'background.paper',
                  cursor: card.route ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                  '&:hover': card.route ? { bgcolor: 'action.hover' } : {},
                }}
              >
                <Icon sx={{ fontSize: 16, color: MUTED, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {card.title}
                  </Typography>
                  {card.subtitle && (
                    <Typography sx={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {card.subtitle}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  {card.badge && (
                    <Chip
                      label={card.badge}
                      size="small"
                      sx={{ fontSize: 9, height: 16, bgcolor: urgencyStyle.bg, color: urgencyStyle.color, fontWeight: 700 }}
                    />
                  )}
                  {card.meta?.status && (
                    <Chip
                      label={String(card.meta.status).replace('_', ' ')}
                      size="small"
                      sx={{ fontSize: 9, height: 16, bgcolor: statusStyle.bg, color: statusStyle.color, fontWeight: 700 }}
                    />
                  )}
                  {card.route && <ChevronRightIcon sx={{ fontSize: 16, color: MUTED }} />}
                </Box>
              </Box>
            </Box>
          );
        })}

        {/* Expand within list */}
        {hasMore && (
          <Box>
            <Divider />
            <Box
              onClick={() => setExpanded(true)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
                py: 1,
                cursor: 'pointer',
                bgcolor: 'background.paper',
                transition: 'background 0.15s',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <ExpandMoreIcon sx={{ fontSize: 14, color: MUTED }} />
              <Typography sx={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>
                Show {cards.length - MAX_LIST} more
              </Typography>
            </Box>
          </Box>
        )}

        {/* View all → navigates to full page */}
        {hasOverflow && listRoute && (
          <Box>
            <Divider />
            <Box
              onClick={() => navigate(listRoute)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                py: 1,
                cursor: 'pointer',
                background: BRAND_GRADIENT,
                transition: 'opacity 0.15s',
                '&:hover': { opacity: 0.88 },
              }}
            >
              <OpenInNewIcon sx={{ fontSize: 13, color: PRIMARY_CONTRAST }} />
              <Typography sx={{ fontSize: 11, color: PRIMARY_CONTRAST, fontWeight: 700 }}>
                View all {totalCount} →
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, count }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
      <Icon sx={{ fontSize: 13, color: MUTED }} />
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
      <Chip
        label={count}
        size="small"
        sx={{ fontSize: 9, height: 16, bgcolor: 'action.hover', color: 'text.secondary', fontWeight: 700 }}
      />
    </Box>
  );
}

// ─── Main renderer ─────────────────────────────────────────────────────────────
export default function AgentCardRenderer({ cards, navigate }) {
  if (!cards?.length) return null;

  const statCards = cards.filter((c) => c.type === 'stat');
  const requestCards = cards.filter((c) => c.type === 'request');
  const hotelCards = cards.filter((c) => c.type === 'hotel');
  const bookingCards = cards.filter((c) => c.type === 'booking');

  const sections = [
    { type: 'request', cards: requestCards, meta: TYPE_META.request },
    { type: 'hotel', cards: hotelCards, meta: TYPE_META.hotel },
    { type: 'booking', cards: bookingCards, meta: TYPE_META.booking },
  ].filter((s) => s.cards.length > 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>
      {/* Stat cards — always grid */}
      {statCards.length > 0 && <StatGrid cards={statCards} />}

      {/* Grouped list/card sections */}
      {sections.map(({ type, cards: sectionCards, meta }) => {
        const Icon = meta.icon;
        const useCardView = sectionCards.length <= CARD_THRESHOLD;
        return (
          <Box key={type}>
            <SectionHeader icon={Icon} label={meta.plural} count={sectionCards.length} />
            {useCardView ? (
              <CardView cards={sectionCards} navigate={navigate} />
            ) : (
              <ListView
                cards={sectionCards}
                navigate={navigate}
                totalCount={sectionCards.length}
                listRoute={sectionCards.length > MAX_LIST ? meta.route : null}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
