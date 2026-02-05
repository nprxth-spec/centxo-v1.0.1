'use client';

import { useState, useEffect } from 'react';

interface AppSettings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
}

export function useAppSettings(): AppSettings {
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [soundEnabled, setSoundEnabledState] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedNotifications = localStorage.getItem('notificationsEnabled');
        const storedSound = localStorage.getItem('soundEnabled');
        if (storedNotifications !== null) {
          setNotificationsEnabledState(JSON.parse(storedNotifications));
        }
        if (storedSound !== null) {
          setSoundEnabledState(JSON.parse(storedSound));
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const setNotificationsEnabled = (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('notificationsEnabled', JSON.stringify(enabled));
    }
  };

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('soundEnabled', JSON.stringify(enabled));
    }
  };

  return {
    notificationsEnabled,
    soundEnabled,
    setNotificationsEnabled,
    setSoundEnabled,
  };
}
