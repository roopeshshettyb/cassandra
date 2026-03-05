import React, { useState } from 'react';
import { Box, Typography, Avatar } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import LocalLaundryServiceIcon from '@mui/icons-material/LocalLaundryService';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import SpaIcon from '@mui/icons-material/Spa';
import CloseIcon from '@mui/icons-material/Close';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { GOLD_GRADIENT, NAVY_GRADIENT, NAVY, MUTED } from '../../theme';
import { REQUEST_STATUS, REQUEST_TYPE_LABEL, extractFirstNote } from '../../constants/requestConfig';
dayjs.extend(relativeTime);

const quickActions = [
  { icon: CleaningServicesIcon, label: 'Housekeeping' },
  { icon: LocalLaundryServiceIcon, label: 'Laundry' },
  { icon: RestaurantIcon, label: 'Dining' },
  { icon: FitnessCenterIcon, label: 'Facilities' },
];

const defaultNudges = [
  {
    id: 'turndown',
    icon: BedtimeIcon,
    title: 'Turndown Service',
    description: 'Would you like us to prepare your room for the evening?',
    action: 'Yes, please',
  },
  {
    id: 'breakfast',
    icon: LocalCafeIcon,
    title: 'Breakfast Tomorrow',
    description: 'Reserve your table for breakfast? Available 7–10:30 AM.',
    action: 'Reserve',
  },
  {
    id: 'spa',
    icon: SpaIcon,
    title: 'Complimentary Spa Session',
    description: 'Enjoy a 15-min welcome massage — available today.',
    action: 'Book Now',
  },
];

export default function GuestHome({ booking, account, onTabChange }) {
  const [dismissedNudges, setDismissedNudges] = useState([]);

  const guestName = account?.name || booking?.guest?.name || 'Guest';
  const hotelName = booking?.hotel?.name || 'Hotel';

  const checkIn = booking?.startTime ? new Date(booking.startTime) : null;
  const checkOut = booking?.endTime ? new Date(booking.endTime) : null;
  const nights = checkIn && checkOut ? Math.round((checkOut - checkIn) / 86400000) : 0;
  const daysRemaining = checkOut ? Math.max(0, Math.round((checkOut - new Date()) / 86400000)) : 0;
  const fmtDate = (d) => d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  const requests = Array.isArray(booking?.requests) ? booking.requests : [];
  const recentRequests = [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 2);

  const visibleNudges = defaultNudges.filter((n) => !dismissedNudges.includes(n.id));

  const initials = guestName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8F7F4', pb: 14 }}>

      {/* ── Sticky Top Nav Bar ─────────────────────────── */}
      <Box
        sx={{
          position: { xs: 'static', sm: 'sticky' },
          top: 0,
          zIndex: 100,
          bgcolor: 'rgba(248,247,244,0.94)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          px: 2.5,
          py: 1.5,
        }}
      >
        <Box sx={{ maxWidth: 640, mx: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}>
            <Typography
              sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'primary.main', lineHeight: 1 }}
            >
              {hotelName}
            </Typography>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
            <Avatar
              sx={{
                width: 34,
                height: 34,
                background: 'linear-gradient(135deg, #D4AF37 0%, #C5A022 100%)',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                display: { xs: 'none', sm: 'flex' },
              }}
            >
              {initials}
            </Avatar>
          </motion.div>
        </Box>
      </Box>

      {/* ── Scrollable Content ─────────────────────────── */}
      <Box sx={{ px: 2.5, pt: 3 }}>
        <Box sx={{ maxWidth: 640, mx: 'auto' }}>

          {/* Guest Welcome Header */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
            <Typography sx={{ fontSize: 26, fontWeight: 700, color: NAVY, lineHeight: 1.2 }}>Welcome back,</Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 700, color: NAVY, mb: 1.5, lineHeight: 1.2 }}>{guestName}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: GOLD_GRADIENT,
                flexShrink: 0,
              }}
            />
            <Typography sx={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>
              {nights} night{nights !== 1 ? 's' : ''}
              {checkIn && checkOut ? ` · ${fmtDate(checkIn)} – ${fmtDate(checkOut)}` : ''}
              {daysRemaining > 0 ? ` · ${daysRemaining}d remaining` : ''}
            </Typography>
          </Box>
        </motion.div>

        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ marginTop: 28 }}>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: MUTED,
              mb: 2,
            }}
          >
            Quick Actions
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1.5,
            }}
          >
            {quickActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <motion.div key={action.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 + i * 0.07 }} whileTap={{ scale: 0.94 }}>
                  <Box
                    onClick={() => onTabChange('concierge')}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                      p: 1.5,
                      borderRadius: 3,
                      bgcolor: '#fff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      cursor: 'pointer',
                      transition: 'box-shadow 0.2s, transform 0.15s',
                      '&:hover': { boxShadow: '0 4px 14px rgba(0,0,0,0.1)' },
                    }}
                  >
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 2,
                        background: GOLD_GRADIENT,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon sx={{ fontSize: 20, color: '#fff' }} />
                    </Box>
                    <Typography
                      sx={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#333',
                        textAlign: 'center',
                        lineHeight: 1.2,
                      }}
                    >
                      {action.label}
                    </Typography>
                  </Box>
                </motion.div>
              );
            })}
          </Box>
        </motion.div>

        {/* Voice CTA Banner */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }} style={{ marginTop: 24 }}>
          <Box
            component={motion.div}
            whileTap={{ scale: 0.98 }}
            onClick={() => onTabChange('concierge')}
            sx={{
              background: NAVY_GRADIENT,
              borderRadius: 3,
              p: 2.5,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(27,35,64,0.18)',
            }}
          >
            <Box
              sx={{
                width: 50,
                height: 50,
                borderRadius: 2,
                background: GOLD_GRADIENT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <SupportAgentIcon sx={{ color: '#fff', fontSize: 26 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, color: '#fff', fontSize: 15, lineHeight: 1.3 }}>Speak to your concierge</Typography>
              <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', mt: 0.4 }}>Ask anything — available 24/7</Typography>
            </Box>
          </Box>
        </motion.div>

        {/* Suggestions */}
        {visibleNudges.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.54 }} style={{ marginTop: 28 }}>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: MUTED,
                mb: 2,
              }}
            >
              Suggestions for You
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <AnimatePresence>
                {visibleNudges.map((nudge, i) => {
                  const Icon = nudge.icon;
                  return (
                    <motion.div key={nudge.id} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14, height: 0 }} transition={{ duration: 0.3, delay: i * 0.08 }}>
                      <Box
                        sx={{
                          position: 'relative',
                          p: 2,
                          borderRadius: 3,
                          bgcolor: '#fff',
                          border: '1px solid rgba(212,175,55,0.18)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Gold left stripe */}
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 4,
                            height: '100%',
                            background: GOLD_GRADIENT,
                            borderRadius: '3px 0 0 3px',
                          }}
                        />
                        {/* Dismiss */}
                        <Box
                          onClick={() => setDismissedNudges((d) => [...d, nudge.id])}
                          sx={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: MUTED,
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.06)' },
                          }}
                        >
                          <CloseIcon sx={{ fontSize: 14 }} />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, pl: 0.75 }}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 2,
                              background: GOLD_GRADIENT,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Icon sx={{ fontSize: 20, color: '#fff' }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0, pr: 3 }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{nudge.title}</Typography>
                            <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.4, lineHeight: 1.55 }}>{nudge.description}</Typography>
                            <Box
                              component={motion.button}
                              whileTap={{ scale: 0.96 }}
                              onClick={() => onTabChange('concierge')}
                              sx={{
                                mt: 1.5,
                                px: 2,
                                py: 0.75,
                                borderRadius: 1.5,
                                background: GOLD_GRADIENT,
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#fff',
                                display: 'inline-block',
                                boxShadow: '0 2px 8px rgba(197,160,34,0.3)',
                              }}
                            >
                              {nudge.action}
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </Box>
          </motion.div>
        )}

        {/* Recent Requests */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} style={{ marginTop: 28 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: MUTED,
              }}
            >
              Recent Requests
            </Typography>
            <Typography onClick={() => onTabChange('requests')} sx={{ fontSize: 12, fontWeight: 700, color: 'primary.main', cursor: 'pointer' }}>
              View all
            </Typography>
          </Box>

          {recentRequests.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {recentRequests.map((req, i) => {
                const st = REQUEST_STATUS[req.status] || REQUEST_STATUS.pending;
                const title = REQUEST_TYPE_LABEL[req.requestType] || req.requestType || 'Request';
                const firstNote = extractFirstNote(req.userNotes);
                return (
                  <motion.div key={req.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 + i * 0.07 }}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        bgcolor: '#fff',
                        border: '1px solid rgba(0,0,0,0.06)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          mb: firstNote ? 1 : 0,
                        }}
                      >
                        <Box sx={{ flex: 1, mr: 1 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 14, color: NAVY }}>{title}</Typography>
                          {firstNote && <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.3, lineHeight: 1.5 }}>{firstNote}</Typography>}
                        </Box>
                        <Box
                          sx={{
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 99,
                            bgcolor: st.bg,
                            flexShrink: 0,
                          }}
                        >
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</Typography>
                        </Box>
                      </Box>
                      <Typography sx={{ fontSize: 11, color: MUTED }}>{dayjs(req.createdAt).fromNow()}</Typography>
                    </Box>
                  </motion.div>
                );
              })}
            </Box>
          ) : (
            <Typography sx={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>No requests yet. Tap a Quick Action or speak to your concierge.</Typography>
          )}
        </motion.div>
        </Box>
      </Box>
    </Box>
  );
}
