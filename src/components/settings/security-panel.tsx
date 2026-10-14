'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { PasswordForm } from './password-form';
import { SessionsCard } from './sessions-card';
import { SettingsPanelHead } from './settings-panel-head';
import { PlatformSignupCard } from './platform-signup-card';

/**
 * "Login & security" section — groups the former Profile-tab password,
 * active-sessions cards, and platform signup controls for owners.
 */
export function SecurityPanel() {
  const t = useTranslations('Settings.security');
  const { isOwner } = useAuth();

  return (
    <section className="max-w-2xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title={t('title')}
        description={t('description')}
      />
      <div className="space-y-4">
        {isOwner && <PlatformSignupCard />}
        <PasswordForm />
        <SessionsCard />
      </div>
    </section>
  );
}
