import { useState } from 'react';

const REMEMBER_ME_KEY = 'supplyline_remember_me';
const EXPIRY_DAYS = 30;

interface RememberMeData {
  employeeNumber: string;
  expiresAt: number;
}

export const useRememberMe = () => {
  const getSavedEmployeeNumber = (): string | null => {
    try {
      const stored = localStorage.getItem(REMEMBER_ME_KEY);
      if (!stored) return null;

      const data: RememberMeData = JSON.parse(stored);

      // Check if expired
      if (Date.now() > data.expiresAt) {
        localStorage.removeItem(REMEMBER_ME_KEY);
        return null;
      }

      return data.employeeNumber;
    } catch (error) {
      console.error('Failed to load remember me data:', error);
      // Clear corrupted data
      localStorage.removeItem(REMEMBER_ME_KEY);
      return null;
    }
  };

  // Load saved employee number using lazy initialization
  const [savedEmployeeNumber, setSavedEmployeeNumber] = useState<string | null>(() =>
    getSavedEmployeeNumber()
  );

  const saveEmployeeNumber = (employeeNumber: string) => {
    const data: RememberMeData = {
      employeeNumber,
      expiresAt: Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    };

    try {
      localStorage.setItem(REMEMBER_ME_KEY, JSON.stringify(data));
      setSavedEmployeeNumber(employeeNumber);
    } catch (error) {
      console.error('Failed to save remember me data:', error);
    }
  };

  const clearRememberMe = () => {
    try {
      localStorage.removeItem(REMEMBER_ME_KEY);
      setSavedEmployeeNumber(null);
    } catch (error) {
      console.error('Failed to clear remember me data:', error);
    }
  };

  return {
    savedEmployeeNumber,
    saveEmployeeNumber,
    getSavedEmployeeNumber,
    clearRememberMe,
  };
};
