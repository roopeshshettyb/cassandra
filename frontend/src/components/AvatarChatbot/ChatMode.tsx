import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
import { WaveformVisualizer } from './WaveformVisualizer';
import { Send, Loader2, MessageSquare } from 'lucide-react';

import { Message } from './types';

interface ChatModeProps {
  onSwitchToVoice: () => void;
  isVoiceSupported: boolean;
  theme: 'light' | 'dark';
  bookingId: number;
  messages: Message[];
  sendMessage: (content: string) => Promise<string | null>;
  isLoading: boolean;
  error: string | null;
}

export const ChatMode: React.FC<ChatModeProps> = ({
  onSwitchToVoice,
  isVoiceSupported,
  bookingId,
  messages,
  sendMessage,
  isLoading,
  error,
}) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // const { messages, isLoading, error, sendMessage } = useSocketChat(bookingId); // Lifted up


  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
    inputRef.current?.focus();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/40 backdrop-blur-md border-b border-white/10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="font-semibold text-white tracking-tight">AI Assistant</span>
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest leading-none">Online</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Reactive Waveform in Header */}
          <div className="w-24 h-8 bg-black/20 rounded-full flex items-center px-3 border border-white/5">
            <WaveformVisualizer
              isActive={true}
              mode={isLoading ? 'speaking' : 'idle'}
              className="w-full h-4"
            />
          </div>

          {isVoiceSupported && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onSwitchToVoice}
              className="h-10 w-10 rounded-full bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 hover:text-blue-300 transition-all border border-blue-500/20"
              title="Switch to Voice Mode"
            >
              <MessageSquare className="h-5 w-5 rotate-180" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12 animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20 shadow-inner">
                <MessageSquare className="h-10 w-10 text-blue-500/50" />
              </div>
              <h3 className="text-xl font-semibold text-white/90">How can I help today?</h3>
              <p className="text-gray-400 max-w-xs mx-auto mt-2 text-sm leading-relaxed">
                Start a conversation to see the 3D assistant react to your messages.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex group animate-in slide-in-from-bottom-2 fade-in duration-300',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-[1.25rem] px-5 py-3 shadow-xl backdrop-blur-md transition-all',
                  message.role === 'user'
                    ? 'bg-blue-600/80 border border-blue-400/30 text-white rounded-br-none shadow-blue-500/10'
                    : 'bg-black/40 border border-white/10 text-white/90 rounded-bl-none'
                )}
              >
                <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{message.content}</p>
                <div
                  className={cn(
                    'text-[10px] mt-2 font-medium uppercase tracking-wider opacity-50',
                    message.role === 'user' ? 'text-right' : 'text-left'
                  )}
                >
                  {formatTime(message.timestamp)}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start animate-in slide-in-from-bottom-1 fade-in duration-300">
              <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-[1.25rem] rounded-bl-none px-5 py-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                  </div>
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Processing</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="max-w-sm mx-auto text-center p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium backdrop-blur-md">
              {error}
            </div>
          )}

        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 sm:p-6 bg-gradient-to-t from-black/60 to-transparent">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-3">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
            className="h-12 sm:h-14 bg-black/40 backdrop-blur-xl border-white/10 focus-visible:ring-blue-500/50 text-white placeholder:text-gray-500 rounded-2xl px-5 text-sm sm:text-base shadow-2xl transition-all"
            aria-label="Message input"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="h-12 w-12 sm:h-14 sm:w-14 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 rounded-2xl shrink-0 transition-all active:scale-95"
            aria-label="Send message"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

