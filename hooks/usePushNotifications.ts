"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { pushNotificationService } from "../lib/push-notifications";
import { supabase } from "../app/lib/supabase";
import { Capacitor } from "@capacitor/core";

export function usePushNotifications(userId: string | null) {
  const router = useRouter();
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize push notifications
  const initialize = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !userId || isInitialized) return;

    try {
      // Initialize listeners
      pushNotificationService.initializeListeners(
        // On token received - save to database
        async (token) => {
          setDeviceToken(token);
          await saveDeviceToken(userId, token);
        },
        // On notification received (foreground)
        (notification) => {
          console.log("Notification received in foreground:", notification);
          // You could show an in-app notification here
        },
        // On notification tapped
        (action) => {
          console.log("Notification tapped:", action);
          // Navigate based on notification data
          const data = action.notification.data;
          if (data?.type === "message") {
            router.push("/chats");
          } else if (data?.type === "care_request") {
            router.push("/scheduler");
          } else if (data?.type === "calendar") {
            router.push("/calendar");
          }
        }
      );

      // Request permissions
      const settings = pushNotificationService.getSettings();
      if (settings.pushEnabled) {
        await pushNotificationService.requestPermissions();
      }

      setIsInitialized(true);
    } catch (error) {
      console.error("Error initializing push notifications:", error);
    }
  }, [userId, isInitialized, router]);

  // Save device token to database
  const saveDeviceToken = async (userId: string, token: string) => {
    try {
      // Check if token already exists for this user
      const { data: existing } = await supabase
        .from("device_tokens")
        .select("id")
        .eq("user_id", userId)
        .eq("token", token)
        .single();

      if (!existing) {
        // Insert new token
        await supabase.from("device_tokens").insert({
          user_id: userId,
          token,
          platform: Capacitor.getPlatform(),
          created_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error saving device token:", error);
    }
  };

  // Update badge count
  const updateBadgeCount = useCallback(async (count: number) => {
    const settings = pushNotificationService.getSettings();
    if (settings.badgeEnabled) {
      await pushNotificationService.setBadge(count);
    }
  }, []);

  // Clear badge
  const clearBadge = useCallback(async () => {
    await pushNotificationService.clearBadge();
  }, []);

  // Show local notification
  const showLocalNotification = useCallback(
    async (title: string, body: string, data?: Record<string, any>) => {
      const settings = pushNotificationService.getSettings();
      if (settings.pushEnabled) {
        await pushNotificationService.showLocalNotification(title, body, data);
      }
    },
    []
  );

  // Initialize on mount
  useEffect(() => {
    if (userId) {
      initialize();
    }

    return () => {
      pushNotificationService.removeListeners();
    };
  }, [userId, initialize]);

  return {
    deviceToken,
    isInitialized,
    updateBadgeCount,
    clearBadge,
    showLocalNotification,
  };
}
