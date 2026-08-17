import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isGuestMode } from '@/lib/demo/demoStore';

export interface UseRealtimeSyncOptions {
  channelName: string;
  table: string;
  schema?: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onDataChange: () => void;
  debounceMs?: number;
  enableFocusRefetch?: boolean;
}

export interface UseRealtimeMultiSyncOptions {
  channelName: string;
  tables: string[];
  onDataChange: () => void;
  debounceMs?: number;
  enableFocusRefetch?: boolean;
}

/**
 * Custom hook to subscribe to single Supabase Postgres Realtime table changes.
 * Automatically debounces callbacks and handles window focus / tab visibility refetches.
 * Safe for Guest/Demo mode (no-op).
 */
export function useRealtimeSync({
  channelName,
  table,
  schema = 'public',
  filter,
  event = '*',
  onDataChange,
  debounceMs = 300,
  enableFocusRefetch = true,
}: UseRealtimeSyncOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onDataChangeRef = useRef(onDataChange);

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  const triggerRefetch = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onDataChangeRef.current();
    }, debounceMs);
  };

  useEffect(() => {
    // 1. Window focus & tab visibility change listener
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        triggerRefetch();
      }
    };

    if (enableFocusRefetch) {
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleFocus);
    }

    // 2. Skip real-time channel setup in Guest/Demo Mode
    if (isGuestMode()) {
      return () => {
        if (enableFocusRefetch) {
          window.removeEventListener('focus', handleFocus);
          document.removeEventListener('visibilitychange', handleFocus);
        }
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }

    // 3. Supabase Realtime channel setup
    const supabase = createClient();
    const uniqueChannel = `${channelName}-${table}-${Math.random().toString(36).substring(2, 7)}`;

    const postgresConfig: any = {
      event,
      schema,
      table,
    };

    if (filter) {
      postgresConfig.filter = filter;
    }

    const channel = supabase
      .channel(uniqueChannel)
      .on('postgres_changes', postgresConfig, () => {
        triggerRefetch();
      })
      .subscribe();

    // 4. Proper cleanup on component unmount
    return () => {
      if (enableFocusRefetch) {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleFocus);
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [channelName, table, schema, filter, event, debounceMs, enableFocusRefetch]);
}

/**
 * Custom hook to subscribe to MULTIPLE Supabase Postgres Realtime tables in a single channel.
 */
export function useRealtimeMultiSync({
  channelName,
  tables,
  onDataChange,
  debounceMs = 300,
  enableFocusRefetch = true,
}: UseRealtimeMultiSyncOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onDataChangeRef = useRef(onDataChange);

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  const triggerRefetch = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onDataChangeRef.current();
    }, debounceMs);
  };

  const tablesKey = tables.join(',');

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        triggerRefetch();
      }
    };

    if (enableFocusRefetch) {
      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleFocus);
    }

    if (isGuestMode()) {
      return () => {
        if (enableFocusRefetch) {
          window.removeEventListener('focus', handleFocus);
          document.removeEventListener('visibilitychange', handleFocus);
        }
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }

    const supabase = createClient();
    const uniqueChannel = `${channelName}-${Math.random().toString(36).substring(2, 7)}`;
    let channel = supabase.channel(uniqueChannel);

    tables.forEach((table) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          triggerRefetch();
        }
      );
    });

    channel.subscribe();

    return () => {
      if (enableFocusRefetch) {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleFocus);
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [channelName, tablesKey, debounceMs, enableFocusRefetch]);
}
