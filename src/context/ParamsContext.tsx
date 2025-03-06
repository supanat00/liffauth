'use client';
import { createContext, useContext, useState, ReactNode } from 'react';

interface RouteParams {
  userId: string | null;
  consent: boolean;
  age: number;
  artistId: number;
  accessId: string;
}

interface ParamsContextType {
  params: RouteParams | null;
  setParams: (user: RouteParams) => void;
}

const ParamsContext = createContext<ParamsContextType | undefined>(undefined);

export const ParamsProvider = ({ children }: { children: ReactNode }) => {
  const [params, setParams] = useState<RouteParams | null>(null);

  return (
    <ParamsContext.Provider value={{ params, setParams }}>
      {children}
    </ParamsContext.Provider>
  );
};

export const useRouteParams = () => {
  const context = useContext(ParamsContext);
  if (!context) {
    throw new Error('useRouteParams must be used within a ParamProvider');
  }
  return context;
};
