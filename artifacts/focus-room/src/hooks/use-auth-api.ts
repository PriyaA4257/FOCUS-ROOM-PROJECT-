import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getMe, 
  login, 
  register, 
  updateProfile,
  getGetMeQueryKey 
} from "@workspace/api-client-react";
import { useAuthStore } from "./use-auth-store";
import { useLocation } from "wouter";

// Wrapper hooks that inject the auth header
export function useAuthApi() {
  const token = useAuthStore((s) => s.token);
  const setToken = useAuthStore((s) => s.setToken);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const userQuery = useQuery({
    queryKey: getGetMeQueryKey(),
    queryFn: () => getMe({ headers: authHeaders }),
    enabled: !!token,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: (data: Parameters<typeof login>[0]) => login(data),
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.setQueryData(getGetMeQueryKey(), data.user);
      setLocation("/rooms");
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: Parameters<typeof register>[0]) => register(data),
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.setQueryData(getGetMeQueryKey(), data.user);
      setLocation("/rooms");
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateProfile>[0]) => 
      updateProfile(data, { headers: authHeaders }),
    onSuccess: (data) => {
      queryClient.setQueryData(getGetMeQueryKey(), data);
    },
  });

  const logout = () => {
    setToken(null);
    queryClient.clear();
    setLocation("/");
  };

  return {
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    isError: userQuery.isError,
    isAuthenticated: !!token && !!userQuery.data,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    updateProfile: updateProfileMutation.mutateAsync,
    isUpdatingProfile: updateProfileMutation.isPending,
    logout,
    authHeaders,
  };
}
