import React, { useCallback, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { MUTED } from '../theme';

/**
 * Sits under a list and asks for the next chunk as it comes into view.
 *
 * The observer is wired up in a callback ref rather than an effect: it is created when the
 * sentinel mounts and disconnected when it unmounts or when there is nothing left to fetch, so a
 * page using this keeps its single effect. `rootMargin` starts the fetch before the reader
 * actually reaches the end, which is what makes the list feel continuous rather than stepped.
 */
function LoadMore({ hasMore, onLoadMore, loaded = 0, total = 0 }) {
  const observerRef = useRef(null);

  const sentinelRef = useCallback(
    (node) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (!node || !hasMore) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
        },
        { rootMargin: '400px' },
      );
      observerRef.current.observe(node);
    },
    // `loaded` belongs here: an observer only reports a *change* in intersection, so if the
    // sentinel is still on screen after a chunk lands it would never fire again and the list
    // would stall. Re-observing on each append re-reports the current state and keeps it going.
    [hasMore, onLoadMore, loaded],
  );

  // Nothing to say on a list that is fully loaded, and nothing to watch either.
  if (!hasMore) return null;

  return (
    <Box ref={sentinelRef} sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
      <Typography sx={{ fontSize: 13, color: MUTED }}>{`Loading more… ${loaded} of ${total}`}</Typography>
    </Box>
  );
}

export default LoadMore;
