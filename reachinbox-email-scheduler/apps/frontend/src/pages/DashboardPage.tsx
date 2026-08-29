import { useState } from 'react';
import { useEmails, useEmailSearch } from '../hooks/useEmails';
import { ScheduledEmailTable } from '../components/ScheduledEmailTable';
import { SentEmailTable } from '../components/SentEmailTable';
import { SearchEmailTable } from '../components/SearchEmailTable';
import { ComposeModal } from '../components/ComposeModal';
import { Plus, Search, Clock, MailCheck, RefreshCw, X } from 'lucide-react';

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const {
    scheduledEmails,
    isLoadingScheduled,
    scheduledError,
    refetchScheduled,
    sentEmails,
    isLoadingSent,
    sentError,
    refetchSent,
  } = useEmails();

  const { data: searchResults = [], isLoading: isSearching } = useEmailSearch(debouncedQuery);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedQuery(searchQuery.trim());
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDebouncedQuery('');
  };

  const isSearchActive = debouncedQuery.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Top Banner: Actions & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Email Queue Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Real-time BullMQ queue monitor and delivery logs
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              refetchScheduled();
              refetchSent();
            }}
            title="Refresh Queues"
            className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsComposeOpen(true)}
            className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 transition transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Compose Email</span>
          </button>
        </div>
      </div>

      {/* Elasticsearch Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value === '') {
                setDebouncedQuery('');
              }
            }}
            placeholder="Search emails by recipient, subject, or content (powered by Elasticsearch)..."
            className="w-full pl-11 pr-24 py-2.5 bg-gray-50 hover:bg-gray-100/75 focus:bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-20 text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shadow-sm"
          >
            Search
          </button>
        </form>
      </div>

      {/* Main Content Area */}
      {isSearchActive ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Search Results</h2>
            <button
              onClick={handleClearSearch}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Back to Queues
            </button>
          </div>
          <SearchEmailTable
            emails={searchResults}
            isLoading={isSearching}
            query={debouncedQuery}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex items-center space-x-2 border-b border-gray-200 pb-2">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                activeTab === 'scheduled'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Scheduled Emails</span>
              <span
                className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'scheduled'
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {scheduledEmails.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                activeTab === 'sent'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MailCheck className="w-4 h-4" />
              <span>Sent Emails</span>
              <span
                className={`ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === 'sent'
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {sentEmails.length}
              </span>
            </button>
          </div>

          {/* Tab Tables */}
          {activeTab === 'scheduled' ? (
            <ScheduledEmailTable
              emails={scheduledEmails}
              isLoading={isLoadingScheduled}
              error={scheduledError as Error | null}
              onRefresh={refetchScheduled}
            />
          ) : (
            <SentEmailTable
              emails={sentEmails}
              isLoading={isLoadingSent}
              error={sentError as Error | null}
              onRefresh={refetchSent}
            />
          )}
        </div>
      )}

      {/* Compose Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
      />
    </div>
  );
}
