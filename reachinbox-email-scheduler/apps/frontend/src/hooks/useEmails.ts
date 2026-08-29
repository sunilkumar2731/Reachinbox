import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailApi } from '../services/api';
import { ScheduleEmailPayload } from '../types';

export function useEmails() {
  const queryClient = useQueryClient();

  const scheduledQuery = useQuery({
    queryKey: ['emails', 'scheduled'],
    queryFn: emailApi.getScheduled,
    refetchInterval: 3000, // Poll every 3 seconds for active queue updates
  });

  const sentQuery = useQuery({
    queryKey: ['emails', 'sent'],
    queryFn: emailApi.getSent,
    refetchInterval: 5000,
  });

  const scheduleMutation = useMutation({
    mutationFn: (payload: ScheduleEmailPayload) => emailApi.schedule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });

  return {
    scheduledEmails: scheduledQuery.data || [],
    isLoadingScheduled: scheduledQuery.isLoading,
    scheduledError: scheduledQuery.error,
    refetchScheduled: scheduledQuery.refetch,

    sentEmails: sentQuery.data || [],
    isLoadingSent: sentQuery.isLoading,
    sentError: sentQuery.error,
    refetchSent: sentQuery.refetch,

    scheduleEmails: scheduleMutation.mutateAsync,
    isScheduling: scheduleMutation.isPending,
    scheduleError: scheduleMutation.error,
  };
}

export function useEmailSearch(query: string) {
  return useQuery({
    queryKey: ['emails', 'search', query],
    queryFn: () => emailApi.search(query),
    enabled: query.trim().length > 0,
    staleTime: 1000 * 30,
  });
}
