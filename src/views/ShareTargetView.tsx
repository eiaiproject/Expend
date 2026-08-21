import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { parseRecordingText } from '../services/naturalTextParser';

/**
 * Web Share Target dispatcher (Android Chrome). Parses shared text and hands
 * a prefilled form to HomeView via router state. No UI — redirects instantly.
 */
export function ShareTargetView() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  useEffect(() => {
    const text = params.get('text') ?? params.get('title') ?? '';
    const { description, amount } = parseRecordingText(text);
    navigate('/', {
      replace: true,
      state: { share: { initialDescription: description || text.trim(), initialAmount: amount } },
    });
  }, [navigate, params]);
  return null;
}

export default ShareTargetView;