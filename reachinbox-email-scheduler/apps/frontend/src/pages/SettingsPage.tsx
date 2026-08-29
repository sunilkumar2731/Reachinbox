import { useState } from 'react';
import { useSlack } from '../hooks/useSlack';
import { useSenders } from '../hooks/useSenders';
import { Slack, Mail, Plus, CheckCircle2, ExternalLink, Loader2, Unplug } from 'lucide-react';

export function SettingsPage() {
  const { status: slackStatus, isLoading: isSlackLoading, disconnect: disconnectSlack, isDisconnecting } = useSlack();
  const { senders, isLoading: isSendersLoading, createSender, isCreating: isCreatingSender } = useSenders();

  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [senderSuccess, setSenderSuccess] = useState('');

  const handleConnectSlack = () => {
    window.location.href = '/api/slack/connect';
  };

  const handleCreateSender = async (e: React.FormEvent) => {
    e.preventDefault();
    setSenderSuccess('');
    try {
      await createSender(newSenderEmail.trim() || undefined);
      setNewSenderEmail('');
      setSenderSuccess('✅ Created new Ethereal SMTP sender account');
      setTimeout(() => setSenderSuccess(''), 3000);
    } catch {
      // Handled by hook
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings & Integrations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage Slack notifications, Ethereal SMTP accounts, and queue monitors
        </p>
      </div>

      {/* 1. Slack OAuth & Rate Limit Alert Integration */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <Slack className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Slack Notifications</h2>
              <p className="text-xs text-gray-500">
                Receive instant Slack alerts whenever an email sender hits its hourly sending limit
              </p>
            </div>
          </div>

          <div>
            {isSlackLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            ) : slackStatus?.connected ? (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Connected ({slackStatus.teamName || 'Workspace'})</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                <span>Disconnected</span>
              </span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-600 space-y-2">
          <p className="font-semibold text-gray-800">⚡ What happens when rate limit is hit?</p>
          <p>
            When a sender exhausts their configured hourly limit (e.g. 100 emails/hr), the worker automatically schedules the remaining jobs for the next hour window and posts a formatted alert to your connected Slack channel.
          </p>
        </div>

        <div className="pt-2 flex items-center space-x-3">
          {slackStatus?.connected ? (
            <button
              onClick={() => disconnectSlack()}
              disabled={isDisconnecting}
              className="flex items-center space-x-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold rounded-xl border border-red-200 transition"
            >
              {isDisconnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unplug className="w-4 h-4" />
              )}
              <span>Disconnect Slack</span>
            </button>
          ) : (
            <button
              onClick={handleConnectSlack}
              className="flex items-center space-x-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-md transition transform active:scale-95"
            >
              <Slack className="w-4 h-4" />
              <span>Connect Slack Workspace</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Ethereal Senders Management */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Ethereal Senders</h2>
              <p className="text-xs text-gray-500">
                Manage test SMTP sender accounts provisioned for this user
              </p>
            </div>
          </div>
        </div>

        {/* Sender Creation Form */}
        <form onSubmit={handleCreateSender} className="flex gap-3">
          <input
            type="email"
            value={newSenderEmail}
            onChange={(e) => setNewSenderEmail(e.target.value)}
            placeholder="Custom sender alias (e.g. outreach@reachinbox.ai) or leave blank"
            className="flex-1 px-3.5 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <button
            type="submit"
            disabled={isCreatingSender}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
          >
            {isCreatingSender ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>Add Sender</span>
          </button>
        </form>

        {senderSuccess && (
          <p className="text-xs text-green-700 font-medium">{senderSuccess}</p>
        )}

        {/* Senders List */}
        {isSendersLoading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : senders.length === 0 ? (
          <div className="text-center p-6 border border-dashed border-gray-200 rounded-xl">
            <p className="text-xs text-gray-500">No senders created yet. Click "Add Sender" to auto-provision an Ethereal SMTP account.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
            {senders.map((s) => (
              <div key={s.id} className="p-3.5 flex items-center justify-between hover:bg-gray-50/50 transition">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{s.email}</p>
                  <p className="text-xs font-mono text-gray-400">Ethereal User: {s.etherealUser}</p>
                </div>
                <span className="text-[11px] text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Bull Board Queue Monitor */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-gray-900">Bull Board Queue Monitor</h3>
          <p className="text-xs text-gray-500">
            Direct real-time inspection of active, delayed, waiting, completed, and failed Redis jobs
          </p>
        </div>
        <a
          href="/admin/queues"
          target="_blank"
          rel="noreferrer"
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl transition"
        >
          <span>Open Bull Board</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
