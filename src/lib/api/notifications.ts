import { Notification, NotificationLog } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function getNotifications(): Promise<Notification[]> {
  const response = await fetch(`${API_URL}/notifications`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch notifications');
  }

  return response.json();
}

export async function createNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
  const response = await fetch(`${API_URL}/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(notification),
  });

  if (!response.ok) {
    throw new Error('Failed to create notification');
  }

  return response.json();
}

export async function updateNotification(id: number, notification: Partial<Notification>): Promise<Notification> {
  const response = await fetch(`${API_URL}/notifications/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(notification),
  });

  if (!response.ok) {
    throw new Error('Failed to update notification');
  }

  return response.json();
}

export async function deleteNotification(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/notifications/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to delete notification');
  }
}

export async function getNotificationLogs(notificationId?: number): Promise<NotificationLog[]> {
  const url = notificationId 
    ? `${API_URL}/notifications/${notificationId}/logs`
    : `${API_URL}/notifications/logs`;
    
  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch notification logs');
  }

  return response.json();
}
