'use client';

import { useEffect, useState } from 'react';
import '../lib/i18n';

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by not rendering until client-side
  if (!mounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
