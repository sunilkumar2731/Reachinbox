import { Email } from '../types';
import { Search, Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface SearchEmailTableProps {
  emails: Email[];
  isLoading: boolean;
  query: string;
}

export function SearchEmailTable({ emails, isLoading, query }: SearchEmailTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-200">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-medium text-gray-600">Searching Elasticsearch index for "{query}"...</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-gray-300 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center mb-3">
          <Search className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-gray-800">No matching emails found</h3>
        <p className="text-xs text-gray-500 max-w-sm mt-1">
          No records in Elasticsearch match your search keyword <span className="font-semibold text-gray-700">"{query}"</span> across recipient, subject, or body.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-3.5 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-blue-900">
          Elasticsearch search results for: <span className="font-mono bg-blue-100/75 px-1.5 py-0.5 rounded text-blue-800">"{query}"</span>
        </p>
        <span className="text-xs text-blue-600 font-medium">{emails.length} match(es)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/75 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              <th className="py-3 px-4">Recipient</th>
              <th className="py-3 px-4">Subject</th>
              <th className="py-3 px-4">Scheduled / Sent Time</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {emails.map((email) => {
              const timeDisplay = email.sentAt
                ? new Date(email.sentAt).toLocaleString()
                : new Date(email.scheduledAt).toLocaleString();

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
                    {email.status === 'SENT' ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>SENT</span>
                      </span>
                    ) : email.status === 'FAILED' ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                        <XCircle className="w-3 h-3" />
                        <span>FAILED</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        <Clock className="w-3 h-3" />
                        <span>{email.status}</span>
                      </span>
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
