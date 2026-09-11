import { Compass } from '@phosphor-icons/react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/ui/Media.js';
import { Screen } from '../components/ui/NavBar.js';

export function NotFoundScreen() {
  const navigate = useNavigate();
  return (
    <Screen title="Not Found">
      <EmptyState
        icon={<Compass />}
        title="Nothing here"
        message="That page doesn't exist in Seen."
        action={
          <Button variant="tinted" onClick={() => navigate('/library', { replace: true })}>
            Go to Library
          </Button>
        }
      />
    </Screen>
  );
}
