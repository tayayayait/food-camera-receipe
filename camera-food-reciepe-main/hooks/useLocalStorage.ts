
import { useState, useEffect } from 'react';

export function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    setStoredValue(prevValue => {
      const valueToStore = typeof value === 'function' ? (value as (val: T) => T)(prevValue) : value;

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
          console.error(error);
        }
      }

      return valueToStore;
    });
  };

  // This effect listens for changes in other tabs
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const parseStoredValue = (value: string) => {
      try {
        return JSON.parse(value) as T;
      } catch (error) {
        console.error(error);
        return null;
      }
    };

    try {
      const existingValue = window.localStorage.getItem(key);
      if (existingValue !== null) {
        const parsed = parseStoredValue(existingValue);
        if (parsed !== null) {
          setStoredValue(parsed);
        }
      }
    } catch (error) {
      console.error(error);
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        if (e.newValue !== null) {
          const parsed = parseStoredValue(e.newValue);
          if (parsed !== null) {
            setStoredValue(parsed);
          }
        } else {
          setStoredValue(initialValue);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [initialValue, key]);

  return [storedValue, setValue];
}
