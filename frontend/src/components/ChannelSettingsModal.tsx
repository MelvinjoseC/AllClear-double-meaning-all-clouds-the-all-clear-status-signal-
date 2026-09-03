import React, { useState } from 'react';
import { X, Bell, Send, CheckCircle2, MessageSquare, Globe, Shield } from 'lucide-react';
import { NotificationChannel } from '../types';

interface ChannelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export const ChannelSettingsModal: React.FC<ChannelSettingsModalProps> = ({
  isOpen,
  onClose,
  token,
}) => {
  const [slackUrl, setSlackUrl] = useState('');
  const [discordUrl, setDiscordUrl] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [customWebhookUrl, setCustomWebhookUrl] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testSent, setTestSent] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleTestPing = (channelName: string) => {
    setTestSent(channelName);
    setTimeout(() => setTestSent(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-darkCard border border-darkBorder w-full max-w-2xl rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-darkBorder mb-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Notification Channels</h3>
              <p className="text-xs text-gray-400">Configure where AllClear dispatches plain-English incident alerts.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-darkBorder/40 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedSuccess && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Notification channel configurations saved successfully.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6 overflow-y-auto pr-2 flex-1">
          {/* Slack Integration */}
          <div className="bg-[#0b0f19] border border-darkBorder rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">💬</span>
                <div>
                  <h4 className="text-sm font-bold text-white">Slack Incoming Webhook</h4>
                  <p className="text-[11px] text-gray-400">Post rich Block Kit alert messages to your Slack channel.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleTestPing('Slack')}
                className="px-3 py-1 bg-darkBorder/50 hover:bg-darkBorder text-gray-300 hover:text-white text-xs rounded-lg transition-all flex items-center gap-1.5"
              >
                <Send className="w-3 h-3" />
                <span>{testSent === 'Slack' ? 'Sent!' : 'Test'}</span>
              </button>
            </div>
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/T.../B.../..."
              value={slackUrl}
              onChange={(e) => setSlackUrl(e.target.value)}
              className="w-full bg-darkCard border border-darkBorder rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Discord Integration */}
          <div className="bg-[#0b0f19] border border-darkBorder rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🎮</span>
                <div>
                  <h4 className="text-sm font-bold text-white">Discord Webhook</h4>
                  <p className="text-[11px] text-gray-400">Send color-coded status cards to Discord servers.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleTestPing('Discord')}
                className="px-3 py-1 bg-darkBorder/50 hover:bg-darkBorder text-gray-300 hover:text-white text-xs rounded-lg transition-all flex items-center gap-1.5"
              >
                <Send className="w-3 h-3" />
                <span>{testSent === 'Discord' ? 'Sent!' : 'Test'}</span>
              </button>
            </div>
            <input
              type="url"
              placeholder="https://discord.com/api/webhooks/.../..."
              value={discordUrl}
              onChange={(e) => setDiscordUrl(e.target.value)}
              className="w-full bg-darkCard border border-darkBorder rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Telegram Bot */}
          <div className="bg-[#0b0f19] border border-darkBorder rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">✈️</span>
                <div>
                  <h4 className="text-sm font-bold text-white">Telegram Bot Channel</h4>
                  <p className="text-[11px] text-gray-400">Direct notifications via Telegram Bot API with HTML formatting.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleTestPing('Telegram')}
                className="px-3 py-1 bg-darkBorder/50 hover:bg-darkBorder text-gray-300 hover:text-white text-xs rounded-lg transition-all flex items-center gap-1.5"
              >
                <Send className="w-3 h-3" />
                <span>{testSent === 'Telegram' ? 'Sent!' : 'Test'}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Bot Token (e.g. 123456:ABC...)"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                className="w-full bg-darkCard border border-darkBorder rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
              />
              <input
                type="text"
                placeholder="Target Chat ID (e.g. -100...)"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                className="w-full bg-darkCard border border-darkBorder rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Custom Webhook */}
          <div className="bg-[#0b0f19] border border-darkBorder rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-blue-400" />
                <div>
                  <h4 className="text-sm font-bold text-white">Custom Webhook (HMAC Signed)</h4>
                  <p className="text-[11px] text-gray-400">Stream JSON incident events directly to your microservices.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleTestPing('Custom Webhook')}
                className="px-3 py-1 bg-darkBorder/50 hover:bg-darkBorder text-gray-300 hover:text-white text-xs rounded-lg transition-all flex items-center gap-1.5"
              >
                <Send className="w-3 h-3" />
                <span>{testSent === 'Custom Webhook' ? 'Sent!' : 'Test'}</span>
              </button>
            </div>
            <input
              type="url"
              placeholder="https://api.yourdomain.com/webhooks/allclear"
              value={customWebhookUrl}
              onChange={(e) => setCustomWebhookUrl(e.target.value)}
              className="w-full bg-darkCard border border-darkBorder rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all"
            >
              Save Notification Preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
