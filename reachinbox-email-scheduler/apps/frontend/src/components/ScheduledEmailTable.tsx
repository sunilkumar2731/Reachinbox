import { Email } from '../types';
import { Clock, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface ScheduledEmailTableProps {
  emails: Email[];
  isLoading: boolean;
  error: Error | null;
  onRefresh: () => void;
}

export function ScheduledEmailTable({ emails, isLoading, error, onRefresh }: ScheduledEmailTableProps) {
  if (isLoading && emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-200">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-gray-600">Loading scheduled queue...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-red-200 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-sm font-semibold text-gray-800">Failed to load scheduled emails</p>
        <p className="text-xs text-gray-500 mt-1 mb-4">{error.message}</p>
        <button
          onClick={onRefresh}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-gray-300 text-center">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-gray-800">No scheduled emails</h3>
        <p className="text-xs text-gray-500 max-w-sm mt-1 mb-4">
          All queue jobs have been processed or you haven't scheduled any email batches yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/75 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              <th className="py-3 px-4">Recipient</th>
              <th className="py-3 px-4">Subject</th>
              <th className="py-3 px-4">Scheduled For</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Bull Job ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {emails.map((email) => {
              const scheduledDate = new Date(email.scheduledAt);
              const isFuture = scheduledDate.getTime() > Date.now();

              return (
                <tr key={email.id} className="hover:bg-gray-50/50 transition">
                  <td className="py-3.5 px-4 font-medium text-gray-900">
                    <span className="truncate block max-w-[200px]" title={email.recipient}>
                      {email.recipient}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-gray-700">
                    <div className="max-w-xs truncate" title={email.subject}>
                      {email.subject}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-gray-500 text-xs">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      <span>{scheduledDate.toLocaleString()}</span>
                      {isFuture && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                          in {Math.ceil((scheduledDate.getTime() - Date.now()) / 1000)}s
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {email.status === 'PROCESSING' ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>PROCESSING</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        SCHEDULED
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-mono text-gray-400">
                    <span className="truncate block max-w-[120px]" title={email.bullJobId || email.id}>
                      {email.bullJobId || email.id}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
