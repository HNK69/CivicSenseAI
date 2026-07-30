import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getNotifications } from '../services/notificationService.js';

/**
 * NotificationContext — tracks unread count and notification list.
 * Polls backend every 30 s for live updates.
 * Plays a short chime when new unread notifications arrive.
 *
 * Sound asset: public/sounds/notification.mp3
 * TODO: drop a real notification.mp3 file into client-user/public/sounds/
 */

/**
 * playNotificationSound — tries to play a short chime sound.
 * Guarded with try/catch; browsers may block autoplay until the user
 * has interacted with the page — in that case, we just skip silently.
 */
const playNotificationSound = () => {
  try {
    // TODO: Replace '/sounds/notification.mp3' with your real audio file.
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Browser autoplay policy blocked — suppress silently
    });
  } catch {
    // Audio API unavailable — suppress silently
  }
};

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(false);
  const prevUnreadRef                     = useRef(0);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getNotifications();
      const newUnread = data.filter(n => !n.read).length;

      // Play sound only if unread count INCREASED (new notification arrived)
      if (newUnread > prevUnreadRef.current) {
        playNotificationSound();
      }
      prevUnreadRef.current = newUnread;

      setNotifications(data);
      setUnreadCount(newUnread);
    } catch (err) {
      // TODO: handle auth/network errors
      console.error('Notification fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    prevUnreadRef.current = 0;
    // TODO: PATCH /api/notifications/mark-all-read
  };

  const markRead = (id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => {
      const next = Math.max(0, prev - 1);
      prevUnreadRef.current = next;
      return next;
    });
    // TODO: PATCH /api/notifications/:id/read
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, fetchNotifications, markAllRead, markRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificationContext must be inside NotificationProvider');
  return ctx;
};

export default NotificationContext;

