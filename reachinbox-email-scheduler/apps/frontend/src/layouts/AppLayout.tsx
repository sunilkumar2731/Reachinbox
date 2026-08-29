import { ReactNode } from 'react';
import { Header } from '../components/Header';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        ReachInbox Production-Grade Email Scheduler • BullMQ Delayed Jobs • Redis Throttling • Elasticsearch Search
      </footer>
    </div>
  );
}
