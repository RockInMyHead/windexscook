import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserHealthProfile } from '../types/health';
import { User } from '../types/recipe';

interface UserContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  updateHealthProfile: (healthProfile: UserHealthProfile) => void;
  isAuthenticated: boolean;
  hasActiveSubscription: boolean;
  activateSubscription: () => void;
  isAdmin: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider = ({ children }: UserProviderProps) => {
  const [user, setUser] = useState<User | null>(null);

  // Загружаем пользователя из localStorage при инициализации
  useEffect(() => {
    const savedUser = localStorage.getItem('ai-chef-user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('ai-chef-user');
      }
    }
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('ai-chef-user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ai-chef-user');
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('ai-chef-user', JSON.stringify(updatedUser));
    }
  };

  const updateHealthProfile = (healthProfile: UserHealthProfile) => {
    if (user) {
      const updatedUser = { ...user, healthProfile };
      setUser(updatedUser);
      localStorage.setItem('ai-chef-user', JSON.stringify(updatedUser));
    }
  };

  const activateSubscription = () => {
    if (user) {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      const updatedUser = { 
        ...user, 
        subscription: {
          active: true,
          expiresAt: expiresAt.toISOString(),
          plan: 'premium' as const
        }
      };
      setUser(updatedUser);
      localStorage.setItem('ai-chef-user', JSON.stringify(updatedUser));
    }
  };

  const hasActiveSubscription = !!(
    user?.subscription?.active && 
    user?.subscription?.expiresAt && 
    new Date(user.subscription.expiresAt) > new Date()
  );

  const isAdmin = user?.role === 'admin';

  const value = {
    user,
    login,
    logout,
    updateUser,
    updateHealthProfile,
    isAuthenticated: !!user,
    hasActiveSubscription,
    activateSubscription,
    isAdmin,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};



