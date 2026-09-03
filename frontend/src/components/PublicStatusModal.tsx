import React, { useState } from 'react';
import { X, Globe, Copy, Check, ExternalLink, ShieldCheck } from 'lucide-react';
import { User, MonitoredItem } from '../types';

interface PublicStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  items: MonitoredItem[];
}

export const PublicStatusModal: React.FC<PublicStatusModalProps> = ({
  isOpen,
  onClose,
  user,
  items,
}) => {
  const [copiedType, setCopiedType] = useState<'md' | 'html' | 'url' | null>(null);

  if (!isOpen || !user) return null;

  const tenantId = user.tenantId;
  const baseUrl = window.location.origin;
  const statusPageUrl = `${baseUrl}/api/public/status/${tenantId}`;
  const badgeSvgUrl = `${baseUrl}/api/public/badges/${tenantId}/status.svg`;

  const markdownSnippet = `[![AllClear Status](${badgeSvgUrl})](${statusPageUrl})`;
  const htmlSnippet = `<a href="${statusPageUrl}"><img src="${badgeSvgUrl}" alt="AllClear Status" /></a>`;

  const copyToClipboard = (text: string, type: 'md' | 'html' | 'url') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const redCount = items.filter((i) => i.status === 'red').length;
  const yellowCount = items.filter((i) => i.status === 'yellow').length;
  const isOperational = redCount === 0 && yellowCount === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-darkCard border border-darkBorder w-full max-w-2xl rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-darkBorder mb-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Public Status Page & Badges</h3>
              <p className="text-xs text-gray-400">Share live uptime transparency with your users and stakeholders.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-darkBorder/40 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto pr-2 flex-1">
          {/* Live Preview Card */}
          <div className="bg-[#0b0f19] border border-darkBorder rounded-2xl p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Live Status Badge Preview</h4>
            <div className="flex items-center gap-4 p-4 bg-darkCard/60 rounded-xl border border-darkBorder/60">
              <img src={`/api/public/badges/${tenantId}/status.svg`} alt="AllClear Badge Preview" className="h-6" />
              <span className="text-xs text-gray-400">
                Auto-refreshes SVG image with zero caching delay.
              </span>
            </div>
          </div>

          {/* Markdown Embed Code */}
          <div className="bg-[#0b0f19] border border-darkBorder rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">GitHub README (Markdown)</h4>
              <button
                onClick={() => copyToClipboard(markdownSnippet, 'md')}
                className="flex items-center gap-1.5 px-3 py-1 bg-darkCard hover:bg-darkBorder text-gray-300 hover:text-white rounded-lg text-xs transition-all border border-darkBorder"
              >
                {copiedType === 'md' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedType === 'md' ? 'Copied!' : 'Copy Markdown'}</span>
              </button>
            </div>
            <pre className="bg-black/50 p-3 rounded-xl text-xs font-mono text-blue-300 overflow-x-auto border border-darkBorder/50">
              {markdownSnippet}
            </pre>
          </div>

          {/* HTML Embed Code */}
          <div className="bg-[#0b0f19] border border-darkBorder rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Website Widget (HTML)</h4>
              <button
                onClick={() => copyToClipboard(htmlSnippet, 'html')}
                className="flex items-center gap-1.5 px-3 py-1 bg-darkCard hover:bg-darkBorder text-gray-300 hover:text-white rounded-lg text-xs transition-all border border-darkBorder"
              >
                {copiedType === 'html' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedType === 'html' ? 'Copied!' : 'Copy HTML'}</span>
              </button>
            </div>
            <pre className="bg-black/50 p-3 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto border border-darkBorder/50">
              {htmlSnippet}
            </pre>
          </div>

          {/* Direct JSON Link */}
          <div className="flex items-center justify-between p-4 bg-[#0b0f19] border border-darkBorder rounded-2xl">
            <div>
              <p className="text-xs font-bold text-white">Public Status JSON API</p>
              <p className="text-[11px] text-gray-400">Direct endpoint for external status dashboards.</p>
            </div>
            <a
              href={statusPageUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all"
            >
              <span>View JSON</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
