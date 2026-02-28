'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/layout/Navbar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Wait for auth to load
    if (isLoading) return;

    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      router.replace('/login?redirect=/admin');
      return;
    }

    // If authenticated but not admin, redirect to dashboard
    if (user?.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }

    // User is authenticated and is admin
    setIsAuthorized(true);
  }, [isLoading, isAuthenticated, user, router]);

  // Show loading while checking auth
  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 sm:pt-32 pb-20">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-cyan"></div>
            <p className="mt-4 text-gray-400">Verifying access...</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

