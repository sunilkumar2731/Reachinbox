import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { useSenders } from '../hooks/useSenders';
import { useEmails } from '../hooks/useEmails';
import { X, Upload, CheckCircle2, AlertCircle, Clock, Send, FileSpreadsheet, Loader2, Sparkles } from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComposeModal({ isOpen, onClose }: ComposeModalProps) {
  const { senders } = useSenders();
  const { scheduleEmails, isScheduling } = useEmails();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderId, setSenderId] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [manualRecipients, setManualRecipients] = useState('');
  const [invalidRecipients, setInvalidRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('');
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const emailRegex = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/g;

  const parseFileContent = (file: File) => {
    setFileName(file.name);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setErrorMsg('Uploaded file is empty');
        return;
      }

      // 1. Try PapaParse for structured CSV rows
      Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          const detectedEmails = new Set<string>();
          const detectedInvalid = new Set<string>();

          // Search inside all parsed cells
          results.data.forEach((row: any) => {
            const cells = Array.isArray(row) ? row : Object.values(row);
            cells.forEach((cell: any) => {
              if (typeof cell === 'string') {
                const matches = cell.match(emailRegex);
                if (matches) {
                  matches.forEach((m) => detectedEmails.add(m.trim().toLowerCase()));
                } else if (cell.includes('@') && cell.trim().length > 3) {
                  detectedInvalid.add(cell.trim());
                }
              }
            });
          });

          // 2. Also run raw text regex search across entire file in case of custom delimiters
          const rawMatches = text.match(emailRegex);
          if (rawMatches) {
            rawMatches.forEach((m) => detectedEmails.add(m.trim().toLowerCase()));
          }

          const validList = Array.from(detectedEmails);
          const invalidList = Array.from(detectedInvalid).filter((inv) => !detectedEmails.has(inv.toLowerCase()));

          if (validList.length === 0) {
            setErrorMsg('No email addresses found in the uploaded file. Please verify file content.');
          }

          setRecipients(validList);
          setInvalidRecipients(invalidList);
        },
        error: (err: any) => {
          // Fallback to raw text matching
          const rawMatches = text.match(emailRegex);
          if (rawMatches && rawMatches.length > 0) {
            const unique = Array.from(new Set(rawMatches.map((m) => m.toLowerCase())));
            setRecipients(unique);
          } else {
            setErrorMsg(`Failed to parse CSV: ${err.message}`);
          }
        },
      });
    };

    reader.onerror = () => {
      setErrorMsg('Failed to read uploaded file');
    };

    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFileContent(file);
    }
    // Reset file input so selecting the same file triggers onChange again
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      parseFileContent(file);
    }
  };

  const getAllRecipients = (): string[] => {
    const manualMatches = manualRecipients.match(emailRegex) || [];
    const manualList = manualMatches.map((e) => e.trim().toLowerCase());
    const combined = Array.from(new Set([...recipients, ...manualList]));
    return combined;
  };

  const allRecipients = getAllRecipients();

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!subject.trim()) {
      setErrorMsg('Please enter an email subject');
      return;
    }
    if (!body.trim()) {
      setErrorMsg('Please enter the email body');
      return;
    }
    if (allRecipients.length === 0) {
      setErrorMsg('Please upload a CSV or enter at least one valid recipient email');
      return;
    }

    try {
      const response = await scheduleEmails({
        subject,
        body,
        recipients: allRecipients,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        delayBetweenEmails: Number(delayBetweenEmails),
        hourlyLimit: Number(hourlyLimit),
        senderId: senderId || undefined,
      });

      setSuccessMsg(`🎉 Successfully scheduled ${response.scheduledCount} email(s)!`);
      setTimeout(() => {
        onClose();
        setSubject('');
        setBody('');
        setRecipients([]);
        setManualRecipients('');
        setInvalidRecipients([]);
        setFileName('');
        setSuccessMsg('');
      }, 1500);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to schedule emails';
      setErrorMsg(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Schedule Email Campaign</h2>
              <p className="text-xs text-gray-500">Configure BullMQ delayed jobs with provider throttling</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSchedule} className="p-6 space-y-5">
          {/* Notifications */}
          {errorMsg && (
            <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center space-x-3 p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Sender & Subject */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Sender Account
              </label>
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">Default Ethereal Account</option>
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Subject Line *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Senior TypeScript Full-Stack Role at ReachInbox"
                required
                className="w-full px-3.5 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Email Body *
            </label>
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi there,&#10;&#10;We're excited to reach out regarding the engineering opportunity..."
              required
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
            />
          </div>

          {/* CSV File Upload & Recipient Detection (with Drag & Drop) */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-5 transition cursor-pointer ${
              isDragging
                ? 'border-blue-500 bg-blue-50/75'
                : 'border-gray-300 bg-gray-50/50 hover:bg-gray-50'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {fileName ? fileName : 'Upload CSV / Leads File'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Click to browse or drag & drop CSV, TXT, or Excel files
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain,application/vnd.ms-excel"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-4 py-2 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 text-xs font-semibold rounded-lg shadow-sm transition flex items-center space-x-1.5"
              >
                <Upload className="w-4 h-4 text-blue-600" />
                <span>{fileName ? 'Replace File' : 'Browse File'}</span>
              </button>
            </div>

            {/* Recipient Count Badges */}
            {allRecipients.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-200/80 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 shadow-sm border border-green-200">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-green-600" />
                  {allRecipients.length} email addresses detected
                </span>

                {invalidRecipients.length > 0 && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                    {invalidRecipients.length} invalid entries skipped
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Quick Demo Sample Data Button */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Or paste emails manually below:</span>
            <button
              type="button"
              onClick={() => {
                setManualRecipients('alex.developer@techcorp.io\nsarah.lead@reachinbox.ai\njohn.doe@innovate.org\nemily.eng@enterprise.dev');
              }}
              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load 4 Sample Recipients</span>
            </button>
          </div>

          {/* Manual Recipient fallback / additions */}
          <div>
            <textarea
              rows={2}
              value={manualRecipients}
              onChange={(e) => setManualRecipients(e.target.value)}
              placeholder="alex@example.com, sara@domain.io (separated by comma or newline)"
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* Scheduling Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
            {/* Start Time */}
            <div>
              <label className="flex items-center space-x-1 text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>Start Time</span>
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Leave empty to start immediately</span>
            </div>

            {/* Delay Between Emails */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Delay / Email (ms)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                value={delayBetweenEmails}
                onChange={(e) => setDelayBetweenEmails(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Spacing between recipient jobs</span>
            </div>

            {/* Hourly Limit */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Hourly Limit
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Max emails per hour window</span>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isScheduling}
              className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-md shadow-blue-500/20 transition"
            >
              {isScheduling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Scheduling {allRecipients.length} jobs...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Schedule {allRecipients.length > 0 ? `(${allRecipients.length})` : ''}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
