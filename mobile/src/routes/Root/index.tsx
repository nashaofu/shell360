import { useBlocker } from 'react-router-dom';

import overlay from '@/utils/overlay';

import Auth from './Auth';
import Content from './Content';

export default function Root() {
  useBlocker(({ historyAction }) => {
    if (historyAction === 'POP' && overlay.length) {
      const fn = overlay.pop();
      fn?.();
      return !!fn;
    }

    return false;
  });

  return (
    <Auth>
      <Content></Content>
    </Auth>
  );
}
