import { BellRinging, PaperPlaneTilt } from '@phosphor-icons/react';
import { useState } from 'react';
import { api } from '../lib/api.js';
import { usePushState } from '../lib/push.js';
import { usePushConfigQuery } from '../lib/queries.js';
import { InsetGroupedList, Row } from './ui/InsetGroupedList.js';
import { Switch } from './ui/Switch.js';

/** Settings section for new-episode notifications. Hidden when the server has no push configured. */
export function NotificationsSettings() {
  const config = usePushConfigQuery();
  const { state, setEnabled } = usePushState(config.data?.publicKey);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  if (!config.data?.enabled) return null;
  if (state.support === 'unsupported') return null;

  if (state.support === 'needs_install') {
    return (
      <InsetGroupedList
        header="Notifications"
        footer="Install Seen to your Home Screen first; iOS only delivers notifications to installed apps."
      >
        <Row
          label="New episodes"
          detail="Available once installed"
          icon={<BellRinging className="size-5" aria-hidden="true" />}
          disabled
        />
      </InsetGroupedList>
    );
  }

  const denied = state.permission === 'denied';
  const sendTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.pushTest();
      setTestResult(
        r.sent === 0
          ? 'No device received it. Turn notifications off and on again.'
          : `Sent to ${r.sent} ${r.sent === 1 ? 'device' : 'devices'}.`,
      );
    } catch {
      setTestResult('Could not send the test.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <InsetGroupedList
      header="Notifications"
      footer={
        denied
          ? 'Notifications are blocked for Seen. Allow them in your device settings to turn this on.'
          : (state.error ??
            testResult ??
            'Get a notification when a series you follow has a new episode you have not watched.')
      }
    >
      <Row
        label="New episodes"
        detail={state.enabled ? 'On this device' : undefined}
        icon={<BellRinging className="size-5" aria-hidden="true" />}
        value={
          <Switch
            aria-label="New episode notifications"
            checked={state.enabled}
            disabled={denied}
            busy={state.busy}
            onChange={(on) => void setEnabled(on)}
          />
        }
      />
      {state.enabled && (
        <Row
          label="Send a test notification"
          icon={<PaperPlaneTilt className="size-5" aria-hidden="true" />}
          onPress={() => void sendTest()}
          disabled={testing}
          chevron={false}
        />
      )}
    </InsetGroupedList>
  );
}
