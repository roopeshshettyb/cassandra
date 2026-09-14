import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckIcon from '@mui/icons-material/Check';
import { STATUS_WARNING, STATUS_WARNING_BG, STATUS_INFO, STATUS_INFO_BG, STATUS_SUCCESS, STATUS_SUCCESS_BG, STATUS_ERROR, STATUS_ERROR_BG } from '../theme';
import CancelIcon from '@mui/icons-material/Cancel';
import LoopIcon from '@mui/icons-material/Loop';

export const REQUEST_STATUS = {
  pending:     { label: 'Pending',     icon: AccessTimeIcon, color: STATUS_WARNING, bg: STATUS_WARNING_BG },
  in_progress: { label: 'In Progress', icon: LoopIcon,       color: STATUS_INFO, bg: STATUS_INFO_BG, spin: true },
  completed:   { label: 'Completed',   icon: CheckIcon,      color: STATUS_SUCCESS, bg: STATUS_SUCCESS_BG },
  cancelled:   { label: 'Cancelled',   icon: CancelIcon,     color: STATUS_ERROR, bg: STATUS_ERROR_BG },
};

export const REQUEST_URGENCY = {
  low:    { label: 'Low',    color: STATUS_SUCCESS },
  medium: { label: 'Medium', color: STATUS_WARNING },
  high:   { label: 'High',   color: STATUS_ERROR },
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
