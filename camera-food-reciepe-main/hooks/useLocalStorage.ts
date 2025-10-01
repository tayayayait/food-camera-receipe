
import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

const coerceValue = <T,>(value: unknown, fallback: T): T => {
  if (value === null || value === undefined) {
    return fallback;
  }

  return value as T;
};

const deserialize = <T,>(rawValue: string | null, fallback: T): T => {
  if (rawValue === null) {
    return fallback;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    return coerceValue<T>(parsedValue, fallback);
  } catch (error) {
    console.error(error);
    return fallback;
  }
};

export function useLocalStorage<T,>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return deserialize(item, initialValue);
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      const coercedValue = coerceValue<T>(valueToStore, initialValue);
      setStoredValue(coercedValue);
      window.localStorage.setItem(key, JSON.stringify(coercedValue));
    } catch (error) {
      console.error(error);
    }
  };

  // This effect listens for changes in other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        setStoredValue(deserialize(e.newValue, initialValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]);

  return [storedValue, setValue];
}
