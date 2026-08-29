import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { slackApi } from '../services/api';

export function useSlack() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['slack', 'status'],
    queryFn: slackApi.getStatus,
  });

  const disconnectMutation = useMutation({
    mutationFn: slackApi.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slack', 'status'] });
    },
  });

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    refetch: statusQuery.refetch,
    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
  };
}
