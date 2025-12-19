/**
 * Event emitter for streaming events to WebSocket clients
 */

// Re-export event types from shared package
export type { EventType, EventCallback } from "@automaker/types";

export interface EventEmitter {
  emit: (type: import("@automaker/types").EventType, payload: unknown) => void;
  subscribe: (callback: import("@automaker/types").EventCallback) => () => void;
}

export function createEventEmitter(): EventEmitter {
  const subscribers = new Set<import("@automaker/types").EventCallback>();

  return {
    emit(type: import("@automaker/types").EventType, payload: unknown) {
      for (const callback of subscribers) {
        try {
          callback(type, payload);
        } catch (error) {
          console.error("Error in event subscriber:", error);
        }
      }
    },

    subscribe(callback: import("@automaker/types").EventCallback) {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
  };
}
