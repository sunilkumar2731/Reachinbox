import { Email } from '../types';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, MailCheck } from 'lucide-react';

interface SentEmailTableProps {
  emails: Email[];
  isLoading: boolean;
  error: Error | null;
  onRefresh: () => void;
}

export function SentEmailTable({ emails, isLoading, error, onRefresh }: SentEmailTableProps) {
  if (isLoading && emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-200">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-gray-600">Loading delivery history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-red-200 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-sm font-semibold text-gray-800">Failed to load sent emails</p>
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
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
          <MailCheck className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-gray-800">No sent emails yet</h3>
        <p className="text-xs text-gray-500 max-w-sm mt-1 mb-4">
          Once your scheduled emails are picked up and sent by the BullMQ worker, their delivery logs will appear here.
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
              <th className="py-3 px-4">Sent / Failed At</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {emails.map((email) => {
              const timeDisplay = email.sentAt
                ? new Date(email.sentAt).toLocaleString()
                : email.failedAt
                ? new Date(email.failedAt).toLocaleString()
                : new Date(email.updatedAt).toLocaleString();

              const isSent = email.status === 'SENT';

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
                    <span>{timeDisplay}</span>
                  </td>
                  <td className="py-3.5 px-4">
                    {isSent ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>SENT</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                        <span>FAILED</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    {email.errorMessage ? (
                      <span
                        className="text-red-600 truncate block max-w-[200px] cursor-help"
                        title={email.errorMessage}
                      >
                        {email.errorMessage}
                      </span>
                    ) : isSent ? (
                      <div className="flex flex-col">
                        <span className="text-emerald-700 font-medium">Delivered via SMTP</span>
                        <span className="text-[10px] text-gray-400">Ethereal / SMTP Transport</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
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
