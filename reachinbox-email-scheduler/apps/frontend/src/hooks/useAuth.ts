import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

export function useAuth() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.getMe,
    staleTime: 1000 * 60 * 5, // 5 mins
    retry: false,
  });

  const devLoginMutation = useMutation({
    mutationFn: ({ email, name }: { email?: string; name?: string }) =>
      authApi.devLogin(email, name),
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], data);
      navigate('/dashboard');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.clear();
      navigate('/login');
    },
  });

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    isError,
    devLogin: devLoginMutation.mutateAsync,
    isDevLoggingIn: devLoginMutation.isPending,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
  };
}
