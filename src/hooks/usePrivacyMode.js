import { useLocalStorage } from './useLocalStorage';

export function usePrivacyMode() {
  const [on, setOn] = useLocalStorage('paraPrivacyModeV1', false);
  const toggle = () => setOn(v => !v);
  return { on, setOn, toggle };
}
