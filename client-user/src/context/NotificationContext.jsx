import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { getNotifications } from '../services/notificationService.js';
import { useAuthContext } from './AuthContext.jsx';

const playNotificationSound = () => {
  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch {}
};

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(false);
  const prevUnreadRef                     = useRef(0);
  const { user }                          = useAuthContext();
  const socketRef                         = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getNotifications();
      const newUnread = data.filter(n => !n.read).length;

      if (newUnread > prevUnreadRef.current) {
        playNotificationSound();
      }
      prevUnreadRef.current = newUnread;

      setNotifications(data);
      setUnreadCount(newUnread);
    } catch (err) {
      console.error('Notification fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Connect Socket.IO using authenticated userId
  useEffect(() => {
    if (!user) return;
    const userId = user._id || user.id;
    if (!userId) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    const socket = io(socketUrl, { withCredentials: true });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('user:join', { userId });
    });

    socket.on('notification:new', (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((c) => c + 1);
      playNotificationSound();
    });

    socket.on('issue:statusUpdated', () => {
      fetchNotifications();
    });

    return () => {
      socket.disconnect();
    };
  }, [user, fetchNotifications]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    prevUnreadRef.current = 0;
  };

  const markRead = (id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id || n._id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => {
      const next = Math.max(0, prev - 1);
      prevUnreadRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

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
