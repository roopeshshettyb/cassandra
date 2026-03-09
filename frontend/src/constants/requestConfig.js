import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckIcon from '@mui/icons-material/Check';
import CancelIcon from '@mui/icons-material/Cancel';
import LoopIcon from '@mui/icons-material/Loop';

export const REQUEST_STATUS = {
  pending:     { label: 'Pending',     icon: AccessTimeIcon, color: '#C5A022', bg: 'rgba(212,175,55,0.12)' },
  in_progress: { label: 'In Progress', icon: LoopIcon,       color: '#2563EB', bg: 'rgba(37,99,235,0.1)', spin: true },
  completed:   { label: 'Completed',   icon: CheckIcon,      color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  cancelled:   { label: 'Cancelled',   icon: CancelIcon,     color: '#DC2626', bg: 'rgba(220,38,38,0.1)' },
};

export const REQUEST_TYPE_LABEL = {
  room_service:     'Room Service',
  house_keeping:    'Housekeeping',
  laundry:          'Laundry',
  airport_transfer: 'Airport Transfer',
};

export const extractFirstNote = (notes) => {
  if (!Array.isArray(notes) || notes.length === 0) return null;
  const first = notes[0];
  return typeof first === 'string' ? first : (first?.text ?? null);
};
