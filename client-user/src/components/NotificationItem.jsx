import { motion } from 'framer-motion';
import { timeAgo } from '../utils/formatDate.js';

/**
 * NotificationItem.jsx — Single notification row with motion.
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
      transition={{ duration: 0.2 }}
    >
      {/* Icon */}
      <div
        className="notif-icon flex-shrink-0"
        style={{
          background: iconBg || 'var(--bg-elevated)',
          color: iconColor || 'var(--text-secondary)',
        }}
      >
        <i className={`bi ${icon || 'bi-bell'}`} />
      </div>

      {/* Content */}
      <div className="flex-grow-1 min-w-0">
        <div
          style={{
            fontWeight: !read ? 600 : 500,
            fontSize: '.875rem',
            color: 'var(--text-primary)',
            lineHeight: 1.4,
          }}
        >
          {title}
        </div>
        {detail && (
          <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
            {detail}
          </div>
        )}
        <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 3 }}>
          {timeAgo(timestamp)}
        </div>
      </div>

      {/* Unread dot */}
      {!read && (
        <motion.div
          className="unread-dot flex-shrink-0"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500 }}
        />
      )}
    </motion.div>
  );
};

export default NotificationItem;
