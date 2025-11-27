import { useEffect } from 'react';
import { socketService } from '@services/socket';
import { useAppSelector } from '@app/hooks';

export const useSocket = () => {
  const token = useAppSelector((state) => state.auth.token);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated && token) {
      socketService.connect(token);
    }

    return () => {
      if (!isAuthenticated) {
        socketService.disconnect();
      }
    };
  }, [isAuthenticated, token]);

  return socketService;
};
