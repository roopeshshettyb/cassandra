import { useEffect, useRef } from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

import { NAVY, NAVY_GRADIENT, MUTED, BORDER, SHADOW, SHADOW_HOVER, NAVY_CONTRAST, TEXT_FAINT_LIGHT } from '../../theme';
import { CARD_SX, ROW_SX, LABEL_SX, StatBox } from './AppCards';

// Gallery card shared by hotels and organisations; callers map their record onto
// the props.
export function EntityCard({
  eyebrow,
  title,
  subtitle,
  subtitleIcon: SubtitleIcon,
  images = [],
  gradient,
  accent = 'var(--app-primary)',
  borderColor,
  stats = [],
  openLabel,
  onOpen,
}) {
  const galleryRef = useRef(null);

  useEffect(() => {
    if (images.length < 2) return;
    let index = 0;
    const id = setInterval(() => {
      index = (index + 1) % images.length;
      const el = galleryRef.current;
      el?.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
    }, 4000);
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <motion.div whileTap={{ scale: 0.98 }} whileHover={{ y: -3 }} transition={{ duration: 0.15 }} style={{ width: '100%' }}>
      <Box
        sx={{
          ...CARD_SX,
          border: `1px solid ${borderColor || BORDER}`,
          boxShadow: borderColor ? `0 2px 12px ${accent}25` : SHADOW,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          '@media (hover: hover)': {
            '&:hover': { boxShadow: borderColor ? `0 8px 28px ${accent}40` : SHADOW_HOVER },
          },
        }}
      >
        {images.length > 0 ? (
          <Box ref={galleryRef} sx={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
            {images.map((url) => (
              <Box key={url} component="img" src={url} alt="" sx={{ width: '100%', height: 150, objectFit: 'cover', flexShrink: 0, scrollSnapAlign: 'start' }} />
            ))}
          </Box>
        ) : (
          <Box sx={{ height: 150, background: gradient || NAVY_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 56, fontWeight: 900, color: TEXT_FAINT_LIGHT, userSelect: 'none' }}>
              {title?.[0]?.toUpperCase()}
            </Typography>
          </Box>
        )}

        <Box sx={{ px: 2.5, pt: 2, pb: 1.75, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ ...LABEL_SX, fontSize: 9.5, color: MUTED, mb: 0.5 }}>{eyebrow || ' '}</Typography>

          <Typography
            sx={{
              fontWeight: 800,
              fontSize: 17,
              color: NAVY,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {title}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75, mb: 1.75, minHeight: 16 }}>
            {SubtitleIcon && <SubtitleIcon sx={{ fontSize: 11, color: MUTED, flexShrink: 0 }} />}
            <Typography sx={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {subtitle}
            </Typography>
          </Box>

          {stats.length > 0 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 1, mb: 1.75 }}>
              {stats.map((stat) => (
                <StatBox key={stat.label} label={stat.label} value={stat.value} sub={stat.sub} />
              ))}
            </Box>
          )}

          <Box sx={{ mt: 'auto', pt: 1.5, borderTop: `1px solid ${BORDER}` }}>
            <Box
              component="button"
              onClick={onOpen}
              sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
                border: 'none',
                borderRadius: 2,
                py: 0.9,
                background: NAVY_GRADIENT,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                color: NAVY_CONTRAST,
                '&:hover': { opacity: 0.92 },
              }}
            >
              {openLabel}
              <ArrowForwardIosIcon sx={{ fontSize: 10 }} />
            </Box>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}

/** Table-view row counterpart. `columns` are rendered after the identity cell. */
export function EntityTableRow({ title, subtitle, avatarUrl, accent = 'var(--app-primary)', badge, columns = [], actionLabel, gridTemplateColumns, onOpen }) {
  return (
    <Box onClick={onOpen} sx={{ ...ROW_SX, display: 'grid', gridTemplateColumns, px: 2.5, py: 1.75, alignItems: 'center', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <Avatar src={avatarUrl || undefined} sx={{ width: 36, height: 36, fontSize: 14, fontWeight: 700, bgcolor: accent, flexShrink: 0 }}>
          {!avatarUrl && title?.[0]?.toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle || '—'}</Typography>
        </Box>
        {badge}
      </Box>
      {columns.map((col, i) => (
        <Typography key={i} sx={{ fontSize: 13, color: col.strong ? NAVY : MUTED, fontWeight: col.strong ? 600 : 400 }}>
          {col.value}
        </Typography>
      ))}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: accent }}>{actionLabel}</Typography>
        <ArrowForwardIosIcon sx={{ fontSize: 9, color: accent }} />
      </Box>
    </Box>
  );
}
