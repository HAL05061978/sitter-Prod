'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../app/lib/supabase';
import { getNotificationTitle, getNotificationMessage } from '../../lib/notification-translator';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

interface NotificationsPanelProps {
  userId: string;
}

export default function NotificationsPanel({ userId }: NotificationsPanelProps) {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications();
  }, [userId]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRescheduleResponse = async (notificationId: string, response: 'accepted' | 'declined') => {
    setRespondingTo(notificationId);
    
    try {
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification) return;

      // Call the handle_reschedule_response function
      const { error: responseError } = await supabase.rpc('handle_reschedule_response', {
        reschedule_request_id: notification.data.reschedule_request_id,
        response_status: response,
        response_notes: null
      });

      if (responseError) throw responseError;

      // Mark the notification as read
      await supabase.rpc('mark_notification_read', {
        notification_id: notificationId
      });

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      // Reload notifications to refresh the list
      await loadNotifications();

    } catch (err) {
      console.error('Error submitting reschedule response:', err);
      alert('Failed to submit response. Please try again.');
    } finally {
      setRespondingTo(null);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        notification_id: notificationId
      });

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase.rpc('mark_all_notifications_read', {
        user_id_param: userId
      });

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const created = new Date(timestamp);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">{t('notificationsTitle')}</h2>
        <div className="text-center py-8 text-gray-500">
          <p>{t('noNotifications')}</p>
          <p className="text-sm">{t('notificationsDescription')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">
          {t('notificationsTitle')}
          {unreadCount > 0 && (
            <span className="ml-2 bg-blue-500 text-white text-xs rounded-full px-2 py-1">
              {unreadCount}
            </span>
          )}
        </h2>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {t('markAllAsRead')}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 rounded-lg border-2 transition-colors ${
              notification.is_read
                ? 'border-gray-200 bg-gray-50'
                : 'border-blue-300 bg-blue-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900">
                    {getNotificationTitle(notification, t)}
                  </h3>
                  {!notification.is_read && (
                    <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1">
                      {t('new')}
                    </span>
                  )}
                </div>
                <p className="text-gray-700 text-sm mb-2">
                  {getNotificationMessage(notification, t)}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatTimeAgo(notification.created_at)}</span>
                  {notification.type === 'reschedule_request' && !notification.is_read && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {t('markAsRead')}
                      </button>
                      <button
                        onClick={() => handleRescheduleResponse(notification.id, 'declined')}
                        disabled={respondingTo === notification.id}
                        className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {respondingTo === notification.id ? t('processing') : t('decline')}
                      </button>
                      <button
                        onClick={() => handleRescheduleResponse(notification.id, 'accepted')}
                        disabled={respondingTo === notification.id}
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {respondingTo === notification.id ? t('processing') : t('accept')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
