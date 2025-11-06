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
  hasActiveTrial: boolean;
  hasPremiumAccess: boolean; // подписка ИЛИ пробный период
  activateSubscription: () => void;
  activateTrialPeriod: () => void;
  isAdmin: boolean;
  trialDaysLeft: number;
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
    // Если это администратор, добавляем Premium подписку
    if (userData.role === 'admin') {
      const adminUser = {
        ...userData,
        subscription: {
          active: true,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          plan: 'premium' as const
        }
      };
      setUser(adminUser);
      localStorage.setItem('ai-chef-user', JSON.stringify(adminUser));
    } else {
      setUser(userData);
      localStorage.setItem('ai-chef-user', JSON.stringify(userData));
    }
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

  // Активация пробного периода на 3 дня
  const activateTrialPeriod = () => {
    if (user) {
      // Проверяем, не был ли уже активирован пробный период
      if (user.trialPeriod?.active) {
        console.log('Пробный период уже активирован');
        return;
      }

      const startedAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 3); // 3 дня пробного периода

      const updatedUser = {
        ...user,
        trialPeriod: {
          active: true,
          startedAt: startedAt.toISOString(),
          expiresAt: expiresAt.toISOString()
        }
      };

      setUser(updatedUser);
      localStorage.setItem('ai-chef-user', JSON.stringify(updatedUser));

      console.log('Пробный период активирован на 3 дня:', {
        startedAt: startedAt.toISOString(),
        expiresAt: expiresAt.toISOString()
      });
    }
  };

  const isAdmin = user?.role === 'admin';

  const hasActiveSubscription = !!(
    user?.subscription?.active &&
    user?.subscription?.expiresAt &&
    new Date(user.subscription.expiresAt) > new Date()
  );

  // Проверка активного пробного периода
  const hasActiveTrial = !!(
    user?.trialPeriod?.active &&
    user?.trialPeriod?.expiresAt &&
    new Date(user.trialPeriod.expiresAt) > new Date()
  );

  // Расчет оставшихся дней пробного периода
  const trialDaysLeft = user?.trialPeriod?.active && user?.trialPeriod?.expiresAt
    ? Math.max(0, Math.ceil((new Date(user.trialPeriod.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Проверка доступа к премиум-функциям (подписка ИЛИ пробный период)
  const hasPremiumAccess = hasActiveSubscription || hasActiveTrial || isAdmin;

  const value = {
    user,
    login,
    logout,
    updateUser,
    updateHealthProfile,
    isAuthenticated: !!user,
    hasActiveSubscription,
    hasActiveTrial,
    hasPremiumAccess,
    activateSubscription,
    activateTrialPeriod,
    isAdmin,
    trialDaysLeft,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};



