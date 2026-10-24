'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Fades in `.reveal` elements as they scroll into view. Re-runs on client navigation.
export default function RevealObserver() {
  const pathname = usePathname();
  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      }),
      { threshold: 0.12 },
    );
    document.querySelectorAll('.reveal:not(.in)').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
