import { Badge } from 'react-bootstrap';
import { getStatusMeta } from '../utils/statusColorMap.js';

/**
 * StatusBadge.jsx — Maps a status string to a Bootstrap Badge.
 *
 * Props:
 *  status  {string}  e.g. "pending", "in-progress", "completed"
 *  size    {string}  "sm" | "md" (default "md")
 *  pill    {boolean} render as pill badge (default true)
 */
const StatusBadge = ({ status = '', size = 'md', pill = true }) => {
  const { variant, label } = getStatusMeta(status);

  const style =
    size === 'sm'
      ? { fontSize: '.68rem', padding: '.28em .6em' }
      : { fontSize: '.75rem', padding: '.35em .75em' };

  return (
    <Badge bg={variant} pill={pill} style={style}>
      {label}
    </Badge>
  );
};

export default StatusBadge;
