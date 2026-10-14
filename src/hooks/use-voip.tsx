'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type VoipStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'calling'
  | 'in_call'
  | 'incoming'
  | 'error';

export interface ActiveCall {
  remoteNumber: string;
  displayName?: string;
  direction: 'incoming' | 'outgoing';
  startTime: number;
  duration: number;
  isMuted: boolean;
}

export interface VoipSettings {
  serverUrl: string;
  sipUri: string;
  password?: string;
  displayName: string;
  autoAnswer: boolean;
  powerDialerEnabled: boolean;
}

interface VoipContextType {
  status: VoipStatus;
  activeCall: ActiveCall | null;
  dialerOpen: boolean;
  setDialerOpen: (open: boolean) => void;
  makeCall: (number: string, displayName?: string) => void;
  hangup: () => void;
  answerCall: () => void;
  rejectCall: () => void;
  muteCall: (muted: boolean) => void;
  sendDTMF: (tone: string) => void;
  settings: VoipSettings;
  updateSettings: (settings: Partial<VoipSettings>) => void;
  fetchNextLeadAndCall: () => Promise<void>;
  isAvailable: boolean;
  setIsAvailable: (available: boolean) => void;
}

const DEFAULT_SETTINGS: VoipSettings = {
  serverUrl: '',
  sipUri: '',
  password: '',
  displayName: 'WACRM Agent',
  autoAnswer: false,
  powerDialerEnabled: false,
};

const VoipContext = createContext<VoipContextType>({
  status: 'disconnected',
  activeCall: null,
  dialerOpen: false,
  setDialerOpen: () => {},
  makeCall: () => {},
  hangup: () => {},
  answerCall: () => {},
  rejectCall: () => {},
  muteCall: () => {},
  sendDTMF: () => {},
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  fetchNextLeadAndCall: async () => {},
  isAvailable: false,
  setIsAvailable: () => {},
});

export function VoipProvider({ children }: { children: React.ReactNode }) {
  const [dialerOpen, setDialerOpen] = useState(false);
  const [settings, setSettings] = useState<VoipSettings>(DEFAULT_SETTINGS);
  const [isAvailable, setIsAvailable] = useState(false);

  const updateSettings = useCallback((newSettings: Partial<VoipSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const makeCall = useCallback(() => {}, []);
  const hangup = useCallback(() => {}, []);
  const answerCall = useCallback(() => {}, []);
  const rejectCall = useCallback(() => {}, []);
  const muteCall = useCallback(() => {}, []);
  const sendDTMF = useCallback(() => {}, []);
  const fetchNextLeadAndCall = useCallback(async () => {}, []);

  return (
    <VoipContext.Provider
      value={{
        status: 'disconnected',
        activeCall: null,
        dialerOpen,
        setDialerOpen,
        makeCall,
        hangup,
        answerCall,
        rejectCall,
        muteCall,
        sendDTMF,
        settings,
        updateSettings,
        fetchNextLeadAndCall,
        isAvailable,
        setIsAvailable,
      }}
    >
      {children}
    </VoipContext.Provider>
  );
}

export function useVoip(): VoipContextType {
  return useContext(VoipContext);
}
