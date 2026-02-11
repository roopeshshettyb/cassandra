import React, { createContext, useContext, useState, useCallback } from 'react';

const HotelThemeContext = createContext(null);

export function HotelThemeProvider({ children }) {
  const [themeConfig, setThemeConfigState] = useState(null);

  const setThemeConfig = useCallback((config) => {
    setThemeConfigState(config && typeof config === 'object' ? config : null);
  }, []);

  const value = { themeConfig, setThemeConfig };

  return <HotelThemeContext.Provider value={value}>{children}</HotelThemeContext.Provider>;
}

export function useHotelTheme() {
  const ctx = useContext(HotelThemeContext);
  if (!ctx) {
    return { themeConfig: null, setThemeConfig: () => {} };
  }
  return ctx;
}
