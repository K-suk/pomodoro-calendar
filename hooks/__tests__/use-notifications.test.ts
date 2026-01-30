import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useNotifications } from "../use-notifications";

describe("useNotifications", () => {
  // Track all notifications created
  const createdNotifications: Array<{ title: string; options: NotificationOptions }> = [];
  const mockClose = vi.fn();

  // Create a mock class for Notification
  class MockNotification {
    title: string;
    options: NotificationOptions;
    onclick: (() => void) | null = null;
    close = mockClose;

    constructor(title: string, options?: NotificationOptions) {
      this.title = title;
      this.options = options || {};
      createdNotifications.push({ title, options: this.options });
    }
  }

  // Store the original Notification
  const originalNotification = global.Notification;

  beforeEach(() => {
    vi.clearAllMocks();
    createdNotifications.length = 0; // Clear the array

    // Replace Notification with our mock class
    (global as unknown as { Notification: typeof MockNotification }).Notification = MockNotification as unknown as typeof Notification;

    // Mock Notification.permission
    Object.defineProperty(global.Notification, "permission", {
      value: "granted",
      writable: true,
      configurable: true,
    });

    // Mock Notification.requestPermission
    (global.Notification as unknown as { requestPermission: () => Promise<string> }).requestPermission = vi.fn().mockResolvedValue("granted");
  });

  afterEach(() => {
    (global as unknown as { Notification: typeof Notification }).Notification = originalNotification;
  });

  describe("permission state", () => {
    it("should initialize with current permission status", () => {
      const { result } = renderHook(() => useNotifications());
      expect(result.current.permission).toBe("granted");
    });

    it("should detect denied permission", () => {
      Object.defineProperty(global.Notification, "permission", {
        value: "denied",
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNotifications());
      expect(result.current.permission).toBe("denied");
    });
  });

  describe("requestPermission", () => {
    it("should request permission and return true when granted", async () => {
      const { result } = renderHook(() => useNotifications());

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.requestPermission();
      });

      expect(global.Notification.requestPermission).toHaveBeenCalled();
      expect(granted).toBe(true);
    });

    it("should return false when permission denied", async () => {
      (global.Notification as unknown as { requestPermission: () => Promise<string> }).requestPermission = vi.fn().mockResolvedValue("denied");

      const { result } = renderHook(() => useNotifications());

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.requestPermission();
      });

      expect(granted).toBe(false);
    });
  });

  describe("sendNotification", () => {
    it("should create a notification with correct title and options", () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.sendNotification("Test Title", { body: "Test Body" });
      });

      expect(createdNotifications).toHaveLength(1);
      expect(createdNotifications[0].title).toBe("Test Title");
      expect(createdNotifications[0].options.body).toBe("Test Body");
      expect(createdNotifications[0].options.icon).toBe("/favicon.ico");
      expect(createdNotifications[0].options.silent).toBe(true);
    });

    it("should not send notification when permission is not granted", () => {
      Object.defineProperty(global.Notification, "permission", {
        value: "denied",
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.sendNotification("Test Title");
      });

      expect(createdNotifications).toHaveLength(0);
    });
  });

  describe("notifyPhaseChange", () => {
    it("should send correct notification for input phase", () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.notifyPhaseChange("input", "Study Math");
      });

      expect(createdNotifications).toHaveLength(1);
      expect(createdNotifications[0].title).toBe("🎯 Focus Time Started");
      expect(createdNotifications[0].options.body).toBe("Study Math - Stay focused!");
      expect(createdNotifications[0].options.tag).toBe("pomodoro-input");
    });

    it("should send correct notification for output phase", () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.notifyPhaseChange("output", "Study Math");
      });

      expect(createdNotifications).toHaveLength(1);
      expect(createdNotifications[0].title).toBe("✏️ Blurting Time!");
      expect(createdNotifications[0].options.body).toBe("Study Math - Time to write what you remember!");
      expect(createdNotifications[0].options.tag).toBe("pomodoro-output");
    });

    it("should send correct notification for completed phase", () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.notifyPhaseChange("completed", "Study Math");
      });

      expect(createdNotifications).toHaveLength(1);
      expect(createdNotifications[0].title).toBe("🎉 Session Complete!");
      expect(createdNotifications[0].options.body).toBe("Study Math - Great job!");
      expect(createdNotifications[0].options.tag).toBe("pomodoro-completed");
    });

    it("should handle missing event title", () => {
      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.notifyPhaseChange("completed");
      });

      expect(createdNotifications).toHaveLength(1);
      expect(createdNotifications[0].title).toBe("🎉 Session Complete!");
      expect(createdNotifications[0].options.body).toBe("Great job!");
    });
  });

  describe("isSupported", () => {
    it("should return true when Notification API is available", () => {
      const { result } = renderHook(() => useNotifications());
      expect(result.current.isSupported).toBe(true);
    });
  });
});
