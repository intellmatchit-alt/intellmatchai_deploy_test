/**
 * useItemizedMatch Hook
 *
 * Hook for fetching itemized match data.
 *
 * @module hooks/itemized-matching/useItemizedMatch
 */

'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api/client';
import type {
  ItemizedMatchResult,
  BatchMatchResult,
} from '@/components/features/itemized-matching/types';

interface UseItemizedMatchOptions {
  skipLlm?: boolean;
  includeRaw?: boolean;
  force?: boolean;
}

interface UseItemizedMatchReturn {
  match: ItemizedMatchResult | null;
  isLoading: boolean;
  error: string | null;
  fetchMatch: (contactId: string, options?: UseItemizedMatchOptions) => Promise<void>;
  clearMatch: () => void;
}

/**
 * Hook for fetching a single itemized match
 */
export function useItemizedMatch(): UseItemizedMatchReturn {
  const [match, setMatch] = useState<ItemizedMatchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatch = useCallback(
    async (contactId: string, options: UseItemizedMatchOptions = {}) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (options.skipLlm) params.append('skipLlm', 'true');
        if (options.includeRaw) params.append('includeRaw', 'true');
        if (options.force) params.append('force', 'true');

        const queryString = params.toString();
        const url = `/matches/itemized/${contactId}${queryString ? `?${queryString}` : ''}`;

        // api.get already unwraps { success, data } and returns data directly
        const result = await api.get<ItemizedMatchResult>(url);

        if (result && result.matchId) {
          setMatch(result);
        } else {
          setError('Failed to fetch match data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch match');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearMatch = useCallback(() => {
    setMatch(null);
    setError(null);
  }, []);

  return {
    match,
    isLoading,
    error,
    fetchMatch,
    clearMatch,
  };
}

interface UseBatchItemizedMatchReturn {
  matches: BatchMatchResult[];
  isLoading: boolean;
  error: string | null;
  fetchMatches: (contactIds: string[]) => Promise<void>;
  clearMatches: () => void;
}

/**
 * Hook for fetching batch itemized matches
 */
export function useBatchItemizedMatch(): UseBatchItemizedMatchReturn {
  const [matches, setMatches] = useState<BatchMatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(async (contactIds: string[]) => {
    if (contactIds.length === 0) {
      setMatches([]);
      return;
    }

    if (contactIds.length > 50) {
      setError('Maximum 50 contacts per batch');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // api.post already unwraps { success, data } and returns data directly
      const result = await api.post<{ matches: BatchMatchResult[]; total: number }>(
        '/matches/itemized/batch',
        { contactIds }
      );

      if (result && result.matches) {
        setMatches(result.matches);
      } else {
        setError('Failed to fetch batch matches');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch matches');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearMatches = useCallback(() => {
    setMatches([]);
    setError(null);
  }, []);

  return {
    matches,
    isLoading,
    error,
    fetchMatches,
    clearMatches,
  };
}

interface UseEventItemizedMatchReturn {
  matches: ItemizedMatchResult[];
  isLoading: boolean;
  error: string | null;
  fetchEventMatches: (eventId: string, token?: string) => Promise<void>;
  fetchSingleMatch: (eventId: string, attendeeId: string, token?: string) => Promise<ItemizedMatchResult | null>;
  clearMatches: () => void;
}

/**
 * Hook for fetching event attendee itemized matches
 */
export function useEventItemizedMatch(): UseEventItemizedMatchReturn {
  const [matches, setMatches] = useState<ItemizedMatchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEventMatches = useCallback(async (eventId: string, token?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = token ? `?token=${token}` : '';
      // api.get already unwraps { success, data } and returns data directly
      const result = await api.get<{ matches: ItemizedMatchResult[]; total: number }>(
        `/events/${eventId}/matches/itemized${params}`
      );

      if (result && result.matches) {
        setMatches(result.matches);
      } else {
        setError('Failed to fetch event matches');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch matches');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSingleMatch = useCallback(
    async (eventId: string, attendeeId: string, token?: string): Promise<ItemizedMatchResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const params = token ? `?token=${token}` : '';
        // api.get already unwraps { success, data } and returns data directly
        const result = await api.get<ItemizedMatchResult>(
          `/events/${eventId}/matches/itemized/${attendeeId}${params}`
        );

        if (result && result.matchId) {
          return result;
        }
        setError('Failed to fetch match');
        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch match');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearMatches = useCallback(() => {
    setMatches([]);
    setError(null);
  }, []);

  return {
    matches,
    isLoading,
    error,
    fetchEventMatches,
    fetchSingleMatch,
    clearMatches,
  };
}

interface UseProjectItemizedMatchReturn {
  match: ItemizedMatchResult | null;
  isLoading: boolean;
  error: string | null;
  fetchProjectMatch: (
    projectId: string,
    targetId: string,
    type?: 'auto' | 'investor' | 'partner' | 'talent'
  ) => Promise<void>;
  clearMatch: () => void;
}

/**
 * Hook for fetching project itemized matches
 */
export function useProjectItemizedMatch(): UseProjectItemizedMatchReturn {
  const [match, setMatch] = useState<ItemizedMatchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjectMatch = useCallback(
    async (
      projectId: string,
      targetId: string,
      type: 'auto' | 'investor' | 'partner' | 'talent' = 'auto'
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        // api.get already unwraps { success, data } and returns data directly
        const result = await api.get<ItemizedMatchResult>(
          `/projects/${projectId}/matches/itemized/${targetId}?type=${type}`
        );

        if (result && result.matchId) {
          setMatch(result);
        } else {
          setError('Failed to fetch project match');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch match');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearMatch = useCallback(() => {
    setMatch(null);
    setError(null);
  }, []);

  return {
    match,
    isLoading,
    error,
    fetchProjectMatch,
    clearMatch,
  };
}

interface UseDealItemizedMatchReturn {
  match: ItemizedMatchResult | null;
  isLoading: boolean;
  error: string | null;
  fetchDealMatch: (
    dealId: string,
    contactId: string,
    type?: 'buyer' | 'provider'
  ) => Promise<void>;
  clearMatch: () => void;
}

/**
 * Hook for fetching deal itemized matches
 */
export function useDealItemizedMatch(): UseDealItemizedMatchReturn {
  const [match, setMatch] = useState<ItemizedMatchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDealMatch = useCallback(
    async (dealId: string, contactId: string, type?: 'buyer' | 'provider') => {
      setIsLoading(true);
      setError(null);

      try {
        const params = type ? `?type=${type}` : '';
        // api.get already unwraps { success, data } and returns data directly
        const result = await api.get<ItemizedMatchResult>(
          `/deals/${dealId}/matches/itemized/${contactId}${params}`
        );

        if (result && result.matchId) {
          setMatch(result);
        } else {
          setError('Failed to fetch deal match');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch match');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearMatch = useCallback(() => {
    setMatch(null);
    setError(null);
  }, []);

  return {
    match,
    isLoading,
    error,
    fetchDealMatch,
    clearMatch,
  };
}

interface UseOpportunityItemizedMatchReturn {
  match: ItemizedMatchResult | null;
  isLoading: boolean;
  error: string | null;
  fetchOpportunityMatch: (
    opportunityId: string,
    candidateId: string,
    type?: 'contact' | 'user'
  ) => Promise<void>;
  clearMatch: () => void;
}

/**
 * Hook for fetching opportunity itemized matches
 */
export function useOpportunityItemizedMatch(): UseOpportunityItemizedMatchReturn {
  const [match, setMatch] = useState<ItemizedMatchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOpportunityMatch = useCallback(
    async (opportunityId: string, candidateId: string, type: 'contact' | 'user' = 'contact') => {
      setIsLoading(true);
      setError(null);

      try {
        // api.get already unwraps { success, data } and returns data directly
        const result = await api.get<ItemizedMatchResult>(
          `/opportunities/${opportunityId}/matches/itemized/${candidateId}?type=${type}`
        );

        if (result && result.matchId) {
          setMatch(result);
        } else {
          setError('Failed to fetch opportunity match');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch match');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearMatch = useCallback(() => {
    setMatch(null);
    setError(null);
  }, []);

  return {
    match,
    isLoading,
    error,
    fetchOpportunityMatch,
    clearMatch,
  };
}

interface UsePitchItemizedMatchReturn {
  match: ItemizedMatchResult | null;
  isLoading: boolean;
  error: string | null;
  fetchPitchMatch: (
    pitchId: string,
    contactId: string
  ) => Promise<void>;
  clearMatch: () => void;
}

/**
 * Hook for fetching pitch itemized matches
 */
export function usePitchItemizedMatch(): UsePitchItemizedMatchReturn {
  const [match, setMatch] = useState<ItemizedMatchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPitchMatch = useCallback(
    async (pitchId: string, contactId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        // api.get already unwraps { success, data } and returns data directly
        const result = await api.get<ItemizedMatchResult>(
          `/pitches/${pitchId}/matches/itemized/${contactId}`
        );

        if (result && result.matchId) {
          setMatch(result);
        } else {
          setError('Failed to fetch pitch match');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch match');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearMatch = useCallback(() => {
    setMatch(null);
    setError(null);
  }, []);

  return {
    match,
    isLoading,
    error,
    fetchPitchMatch,
    clearMatch,
  };
}

export default useItemizedMatch;
