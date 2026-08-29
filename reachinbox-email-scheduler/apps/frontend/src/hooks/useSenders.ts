import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { senderApi } from '../services/api';

export function useSenders() {
  const queryClient = useQueryClient();

  const sendersQuery = useQuery({
    queryKey: ['senders', 'list'],
    queryFn: senderApi.list,
  });

  const createSenderMutation = useMutation({
    mutationFn: (email?: string) => senderApi.create(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders', 'list'] });
    },
  });

  return {
    senders: sendersQuery.data || [],
    isLoading: sendersQuery.isLoading,
    refetch: sendersQuery.refetch,
    createSender: createSenderMutation.mutateAsync,
    isCreating: createSenderMutation.isPending,
  };
}
