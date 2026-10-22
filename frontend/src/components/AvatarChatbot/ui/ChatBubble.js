import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { MUTED, BRAND_GRADIENT, PRIMARY_CONTRAST, BORDER, SHADOW } from '../../../theme';

dayjs.extend(relativeTime);

/** One message, as both the concierge and the public booking chat draw it. */
export default function ChatBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.1,
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser ? BRAND_GRADIENT : 'background.paper',
          bgcolor: isUser ? undefined : 'background.paper',
          border: isUser ? 'none' : `1px solid ${BORDER}`,
          boxShadow: SHADOW,
          color: isUser ? PRIMARY_CONTRAST : 'text.primary',
          '& p': { m: 0 },
          '& ul, & ol': { m: 0, pl: 2 },
          '& li': { mt: 0.4 },
          '& a': { color: 'inherit' },
          '& code': { fontFamily: 'monospace', fontSize: 12 },
        }}
      >
        {/* Hard breaks: Markdown joins single lines, and a read-back summary ran into one line. */}
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{(message.content || '').replace(/\n/g, '  \n')}</ReactMarkdown>
      </Box>
      {message.createdAt && (
        <Typography sx={{ fontSize: 10, color: MUTED, alignSelf: isUser ? 'flex-end' : 'flex-start', px: 0.5 }}>
          {dayjs(message.createdAt).fromNow()}
        </Typography>
      )}
    </motion.div>
  );
}
