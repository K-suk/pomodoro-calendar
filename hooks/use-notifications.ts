"use client";

import { useCallback, useEffect, useState } from "react";

type NotificationPermission = "default" | "granted" | "denied";

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  // Check permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Request permission
  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      console.warn("This browser does not support notifications");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === "granted";
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return false;
    }
  }, []);

  // Send notification
  const sendNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return null;
      }

      if (Notification.permission !== "granted") {
        console.warn("Notification permission not granted");
        return null;
      }

      try {
        const notification = new Notification(title, {
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          silent: true, // No sound
          ...options,
        });

        // When notification is clicked, focus the window
        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        // Auto-close after 10 seconds
        setTimeout(() => notification.close(), 10000);

        return notification;
      } catch (error) {
        console.error("Failed to send notification:", error);
        return null;
      }
    },
    []
  );

  // Send timer phase notification
  const notifyPhaseChange = useCallback(
    (phase: "input" | "output" | "break" | "completed", eventTitle?: string) => {
      let title: string;
      let body: string;

      switch (phase) {
        case "input":
          title = "🎯 Focus Time Started";
          body = eventTitle ? `${eventTitle} - Stay focused!` : "Stay focused!";
          break;
        case "output":
          title = "✏️ Blurting Time!";
          body = eventTitle
            ? `${eventTitle} - Time to write what you remember!`
            : "Time to write what you remember!";
          break;
        case "break":
          title = "☕ Break Time!";
          body = eventTitle
            ? `${eventTitle} - Take a well-deserved rest.`
            : "Take a well-deserved rest. Don't forget to submit feedback!";
          break;
        case "completed":
          title = "🎉 Session Complete!";
          body = eventTitle
            ? `${eventTitle} - Great job!`
            : "Great job!";
          break;
        default:
          return null;
      }

      return sendNotification(title, { body, tag: `pomodoro-${phase}` });
    },
    [sendNotification]
  );

  return {
    permission,
    isSupported: typeof window !== "undefined" && "Notification" in window,
    requestPermission,
    sendNotification,
    notifyPhaseChange,
  };
}
