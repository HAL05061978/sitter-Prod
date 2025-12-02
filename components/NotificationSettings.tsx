"use client";

import { useState, useEffect } from "react";
import { pushNotificationService, NotificationSettings } from "../lib/push-notifications";
import { Capacitor } from "@capacitor/core";

interface Props {
  onClose?: () => void;
}

export default function NotificationSettingsPanel({ onClose }: Props) {
  const [settings, setSettings] = useState<NotificationSettings>({
    pushEnabled: true,
    badgeEnabled: true,
    soundEnabled: true,
    messagesEnabled: true,
    careRequestsEnabled: true,
    remindersEnabled: true,
  });
  const [permissionStatus, setPermissionStatus] = useState<"granted" | "denied" | "prompt">("prompt");
  const [isNative, setIsNative] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load settings
    const savedSettings = pushNotificationService.getSettings();
    setSettings(savedSettings);

    // Check if we're on native platform
    setIsNative(Capacitor.isNativePlatform());

    // Check permission status
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    if (Capacitor.isNativePlatform()) {
      const status = await pushNotificationService.checkPermissions();
      setPermissionStatus(status);
    }
  };

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      const granted = await pushNotificationService.requestPermissions();
      if (granted) {
        setPermissionStatus("granted");
        updateSetting("pushEnabled", true);
      } else {
        setPermissionStatus("denied");
      }
    } catch (error) {
      console.error("Error enabling notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    pushNotificationService.saveSettings(newSettings);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Notification Settings</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Push Notification Permission Status */}
      {isNative && (
        <div className="mb-6 p-4 rounded-lg bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Push Notifications</h3>
              <p className="text-sm text-gray-500">
                {permissionStatus === "granted"
                  ? "Notifications are enabled"
                  : permissionStatus === "denied"
                  ? "Notifications are blocked"
                  : "Enable to receive notifications"}
              </p>
            </div>
            {permissionStatus === "granted" ? (
              <span className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-full">
                Enabled
              </span>
            ) : permissionStatus === "denied" ? (
              <span className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-full">
                Blocked
              </span>
            ) : (
              <button
                onClick={handleEnableNotifications}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Enabling..." : "Enable"}
              </button>
            )}
          </div>
          {permissionStatus === "denied" && (
            <p className="mt-2 text-xs text-gray-500">
              To enable notifications, go to your device Settings &gt; SitterApp &gt; Notifications
            </p>
          )}
        </div>
      )}

      {!isNative && (
        <div className="mb-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
          <p className="text-sm text-yellow-700">
            Push notifications are only available in the mobile app.
          </p>
        </div>
      )}

      {/* Badge Settings */}
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900 border-b pb-2">App Badge</h3>

        <SettingToggle
          label="Show badge on app icon"
          description="Display unread count on the app icon"
          enabled={settings.badgeEnabled}
          onChange={(value) => updateSetting("badgeEnabled", value)}
        />
      </div>

      {/* Sound Settings */}
      <div className="space-y-4 mt-6">
        <h3 className="font-medium text-gray-900 border-b pb-2">Sound</h3>

        <SettingToggle
          label="Notification sounds"
          description="Play a sound for new notifications"
          enabled={settings.soundEnabled}
          onChange={(value) => updateSetting("soundEnabled", value)}
        />
      </div>

      {/* Notification Types */}
      <div className="space-y-4 mt-6">
        <h3 className="font-medium text-gray-900 border-b pb-2">Notification Types</h3>

        <SettingToggle
          label="Messages"
          description="New messages from other parents"
          enabled={settings.messagesEnabled}
          onChange={(value) => updateSetting("messagesEnabled", value)}
        />

        <SettingToggle
          label="Care Requests"
          description="New care requests and responses"
          enabled={settings.careRequestsEnabled}
          onChange={(value) => updateSetting("careRequestsEnabled", value)}
        />

        <SettingToggle
          label="Reminders"
          description="Upcoming events and scheduled care"
          enabled={settings.remindersEnabled}
          onChange={(value) => updateSetting("remindersEnabled", value)}
        />
      </div>
    </div>
  );
}

// Toggle Switch Component
function SettingToggle({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
          enabled ? "bg-indigo-600" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
