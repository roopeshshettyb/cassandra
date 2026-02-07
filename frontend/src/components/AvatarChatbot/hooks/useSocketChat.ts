
import { useState, useCallback, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Message } from '../types';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:7676';

export function useSocketChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const currentResponseRef = useRef<string>('');

    useEffect(() => {
        const token = localStorage.getItem('token') || 'demo-token';
        const bookingId = 999;

        const socket = io(`${BACKEND_URL}/chat`, {
            query: { token, bookingId: String(bookingId) },
        });

        socket.on('connect', () => {
            console.log('Connected to chat server');
            setError(null);
        });

        socket.on('connect_error', (err) => {
            console.error('Connection error:', err);
            setError('Connection failed');
        });

        socket.on('stream_chunk', (payload) => {
            currentResponseRef.current += payload.content;
            // Update the last assistant message
            setMessages((prev) => {
                const newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                    const updatedMsg = { ...lastMsg, content: currentResponseRef.current };
                    newMsgs[newMsgs.length - 1] = updatedMsg;
                    return newMsgs;
                }
                return prev;
            });
        });

        socket.on('stream_end', (payload) => {
            setIsLoading(false);
            // Ensure full content is set
            setMessages((prev) => {
                const newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                    const updatedMsg = { ...lastMsg, content: payload.content || currentResponseRef.current };
                    newMsgs[newMsgs.length - 1] = updatedMsg;
                    return newMsgs;
                }
                return prev;
            });
            currentResponseRef.current = '';
        });

        socket.on('error', (err) => {
            console.error('Socket error:', err);
            setError(err.message || 'Socket error');
            setIsLoading(false);
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, []);

    const sendMessage = useCallback(async (content: string): Promise<string | null> => {
        if (!content.trim() || !socketRef.current) return null;

        setIsLoading(true);
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMsg]);

        // Create a placeholder for assistant response
        const assistantMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '',
            timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMsg]);
        currentResponseRef.current = '';

        socketRef.current.emit('message', { content });

        return new Promise<string>((resolve) => {
            const socket = socketRef.current;
            let fullText = '';

            const onChunk = (payload: any) => {
                fullText += payload.content;
            };

            const onEnd = (payload: any) => {
                socket?.off('stream_chunk', onChunk);
                socket?.off('stream_end', onEnd);
                resolve(payload.content || fullText);
            };

            socket?.on('stream_chunk', onChunk);
            socket?.on('stream_end', onEnd);
        });

    }, []);

    const clearMessages = useCallback(() => {
        setMessages([]);
    }, []);

    return { messages, isLoading, error, sendMessage, clearMessages };
}
