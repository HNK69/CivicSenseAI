import { motion, AnimatePresence } from 'framer-motion';
import { timeAgo } from '../utils/formatDate.js';

/**
 * NotificationItem.jsx — Single notification row.
 *
 * Props:
 *  notification  {Object}    { id, icon, iconBg, iconColor, title, detail, timestamp, read }
 *  onMarkRead    {Function}  Called with notification.id when clicked
 */
const NotificationItem = ({ notification, onMarkRead }) => {
  const { id, icon, iconBg, iconColor, title, detail, timestamp, read } = notification;

  return (
    <motion.div
      className={`notif-item ${!read ? 'unread' : ''}`}
      onClick={() => !read && onMarkRead?.(id)}
      style={{ cursor: !read ? 'pointer' : 'default' }}
      id={`notif-item-${id}`}
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {/* Icon */}
      <div
        className="notif-icon flex-shrink-0"
        style={{ background: iconBg || '#f1f5f9', color: iconColor || '#64748b' }}
      >
        <i className={`bi ${icon || 'bi-bell-fill'}`} />
      </div>

      {/* Content */}
      <div className="flex-grow-1 min-w-0">
        <div
          className={!read ? 'fw-bold' : 'fw-semibold'}
          style={{ fontSize: '.87rem', color: '#1e293b', lineHeight: 1.4 }}
        >
          {title}
        </div>
        {detail && (
          <div className="text-muted mt-1" style={{ fontSize: '.78rem', lineHeight: 1.4 }}>
            {detail}
          </div>
        )}
        <div className="mt-1" style={{ fontSize: '.72rem', color: '#94a3b8' }}>
          {timeAgo(timestamp)}
        </div>
      </div>

      {/* Unread dot */}
      <AnimatePresence>
        {!read && (
          <motion.div
            className="unread-dot flex-shrink-0"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ duration: 0.15 }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default NotificationItem;
