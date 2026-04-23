/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic2, 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Settings2, 
  Type as TypeIcon, 
  User, 
  Volume2,
  Loader2,
  Plus,
  Trash2,
  ChevronRight,
  Sparkles,
  Headphones
} from 'lucide-react';
import { parseTextToScript, generatePodcastAudio, generateVoiceSample, PodcastScript, VoiceConfig, ScriptLine } from './services/geminiService';

const VOICES = [
  { name: 'Puck', description: 'پرانرژی و جوان' },
  { name: 'Charon', description: 'عمیق و جدی' },
  { name: 'Kore', description: 'روشن و دوستانه' },
  { name: 'Fenrir', description: 'قوی و با اعتماد به نفس' },
  { name: 'Zephyr', description: 'ملایم و آرام' }
] as const;

export default function App() {
  const [inputText, setInputText] = useState('');
  const [script, setScript] = useState<PodcastScript | null>(null);
  const [voiceConfigs, setVoiceConfigs] = useState<VoiceConfig[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSampling, setIsSampling] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle parsing text to script
  const handleParse = async () => {
    if (!inputText.trim()) return;
    setIsParsing(true);
    setError(null);
    try {
      const parsed = await parseTextToScript(inputText);
      setScript(parsed);
      // Initialize voice configs
      const initialVoices = parsed.speakers.map((s, i) => ({
        speaker: s,
        voiceName: (i === 0 ? 'Kore' : 'Puck') as VoiceConfig['voiceName']
      }));
      setVoiceConfigs(initialVoices);
    } catch (err) {
      setError("خطا در تحلیل متن. لطفا دوباره تلاش کنید.");
      console.error(err);
    } finally {
      setIsParsing(false);
    }
  };

  // Handle playing a voice sample
  const handlePlaySample = async (voiceName: VoiceConfig['voiceName']) => {
    setIsSampling(voiceName);
    setError(null);
    try {
      const base64Audio = await generateVoiceSample(voiceName);
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const audioData = new Int16Array(bytes.buffer);
      const floatData = new Float32Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        floatData[i] = audioData[i] / 32768.0;
      }
      
      const buffer = audioContextRef.current.createBuffer(1, floatData.length, 24000);
      buffer.getChannelData(0).set(floatData);
      
      playBuffer(buffer);
    } catch (err) {
      setError("خطا در پخش نمونه صدا.");
      console.error(err);
    } finally {
      setIsSampling(null);
    }
  };

  // Handle generating audio
  const handleGenerate = async () => {
    if (!script) return;
    setIsGenerating(true);
    setError(null);
    try {
      const base64Audio = await generatePodcastAudio(script, voiceConfigs);
      
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const audioData = new Int16Array(bytes.buffer);
      const floatData = new Float32Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        floatData[i] = audioData[i] / 32768.0;
      }
      
      const buffer = audioContextRef.current.createBuffer(1, floatData.length, 24000);
      buffer.getChannelData(0).set(floatData);
      
      const wavBlob = createWavBlob(floatData, 24000);
      const url = URL.createObjectURL(wavBlob);
      setAudioUrl(url);
      
      playBuffer(buffer);
    } catch (err) {
      setError("خطا در تولید پادکست. لطفا دوباره تلاش کنید.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const playBuffer = (buffer: AudioBuffer) => {
    if (audioBufferSourceRef.current) {
      audioBufferSourceRef.current.stop();
    }
    
    const source = audioContextRef.current!.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current!.destination);
    source.onended = () => setIsPlaying(false);
    source.start();
    audioBufferSourceRef.current = source;
    setIsPlaying(true);
  };

  const stopAudio = () => {
    if (audioBufferSourceRef.current) {
      audioBufferSourceRef.current.stop();
      setIsPlaying(false);
    }
  };

  const createWavBlob = (samples: Float32Array, sampleRate: number) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  const updateLine = (index: number, newText: string) => {
    if (!script) return;
    const newLines = [...script.lines];
    newLines[index].text = newText;
    setScript({ ...script, lines: newLines });
  };

  const addLine = (speaker: string) => {
    if (!script) return;
    setScript({
      ...script,
      lines: [...script.lines, { speaker, text: '' }]
    });
  };

  const removeLine = (index: number) => {
    if (!script) return;
    const newLines = script.lines.filter((_, i) => i !== index);
    setScript({ ...script, lines: newLines });
  };

  const clearAll = () => {
    setInputText('');
    setScript(null);
    setAudioUrl(null);
    setVoiceConfigs([]);
    stopAudio();
  };

  const updateVoice = (speaker: string, voiceName: VoiceConfig['voiceName']) => {
    setVoiceConfigs(prev => prev.map(v => v.speaker === speaker ? { ...v, voiceName } : v));
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]" dir="rtl">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#141414] rounded-full flex items-center justify-center text-[#E4E3E0]">
            <Mic2 size={20} />
          </div>
          <div>
            <h1 className="font-serif italic text-xl tracking-tight">پادکست‌ساز دو نفره</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-50 font-mono">موتور هوش مصنوعی چند گوینده</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={clearAll}
            className="text-[10px] font-mono uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity flex items-center gap-2"
          >
            <RotateCcw size={12} /> بازنشانی سیستم
          </button>
          <div className="w-[1px] h-8 bg-[#141414]/10" />
          <div className="flex flex-col items-start translate-x-4">
            <span className="text-[10px] font-mono opacity-50 uppercase">وضعیت</span>
            <span className="text-xs font-mono flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isGenerating || isParsing ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
              {isGenerating ? 'در حال تولید پادکست...' : isParsing ? 'در حال تحلیل متن...' : 'آماده'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input & Settings */}
        <div className="lg:col-span-4 space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif italic text-lg text-right w-full">متن ورودی</h2>
              <TypeIcon size={16} className="opacity-30" />
            </div>
            <div className="relative group">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="مقاله، یادداشت یا متن خود را اینجا بچسبانید..."
                className="w-full h-64 bg-white border border-[#141414] p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#141414]/10 resize-none transition-all text-right"
              />
              <div className="absolute bottom-4 left-4 flex gap-2">
                <button
                  onClick={handleParse}
                  disabled={isParsing || !inputText.trim()}
                  className="bg-[#141414] text-[#E4E3E0] px-4 py-2 text-xs font-mono uppercase tracking-wider flex items-center gap-2 hover:bg-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isParsing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  تحلیل و پردازش
                </button>
              </div>
            </div>
          </section>

          {script && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-serif italic text-lg text-right w-full">تنظیمات صدا</h2>
                <Settings2 size={16} className="opacity-30" />
              </div>
              <div className="space-y-4">
                {voiceConfigs.map((config) => (
                  <div key={config.speaker} className="bg-white border border-[#141414] p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase tracking-wider opacity-50 flex items-center gap-2">
                        <User size={12} /> {config.speaker}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {VOICES.map((v) => (
                        <div key={v.name} className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateVoice(config.speaker, v.name as VoiceConfig['voiceName'])}
                              className={`flex-1 text-[10px] font-mono py-2 border transition-all text-center ${
                                config.voiceName === v.name 
                                  ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' 
                                  : 'border-[#141414]/20 hover:border-[#141414]'
                              }`}
                            >
                              {v.name}
                            </button>
                            <button
                              onClick={() => handlePlaySample(v.name as VoiceConfig['voiceName'])}
                              disabled={isSampling === v.name}
                              className={`p-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all disabled:opacity-50`}
                              title="پخش نمونه صدا"
                            >
                              {isSampling === v.name ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                            </button>
                          </div>
                          <span className={`text-[9px] font-sans opacity-50 text-right pr-2 ${config.voiceName === v.name ? 'opacity-100 font-bold' : ''}`}>
                            {v.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full bg-[#141414] text-[#E4E3E0] py-4 font-mono uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#2a2a2a] disabled:opacity-50 transition-all group"
              >
                {isGenerating ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <Volume2 size={20} className="group-hover:scale-110 transition-transform" />
                    تولید پادکست
                  </>
                )}
              </button>
            </motion.section>
          )}
        </div>

        {/* Right Column: Script Editor & Preview */}
        <div className="lg:col-span-8 space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif italic text-lg text-right w-full">متن گفت‌وگو</h2>
              {audioUrl && (
                <div className="flex items-center gap-3 whitespace-nowrap">
                  <button 
                    onClick={isPlaying ? stopAudio : () => {}}
                    className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider hover:underline"
                  >
                    {isPlaying ? <Pause size={12} /> : <Play size={12} />} {isPlaying ? 'توقف' : 'پخش'}
                  </button>
                  <a 
                    href={audioUrl} 
                    download="podcast.wav"
                    className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider hover:underline"
                  >
                    <Download size={12} /> خروجی WAV
                  </a>
                </div>
              )}
            </div>

            <div className="bg-white border border-[#141414] min-h-[600px] flex flex-col">
              {!script ? (
                <div className="flex-1 flex flex-col items-center justify-center opacity-20 space-y-4">
                  <Mic2 size={48} />
                  <p className="font-mono text-xs uppercase tracking-widest text-center">
                    تحلیل متن برای تولید<br />متن گفت‌وگو
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[700px]">
                    <AnimatePresence mode="popLayout">
                      {script.lines.map((line, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: idx * 0.05 }}
                          className="group relative"
                        >
                          <div className="flex items-start gap-4 flex-row-reverse">
                            <div className="w-24 shrink-0 pt-1 text-right">
                              <span className="text-[10px] font-mono uppercase tracking-wider opacity-40 block truncate">
                                {line.speaker}
                              </span>
                              <div className="w-full h-[1px] bg-[#141414]/10 mt-1" />
                            </div>
                            <textarea
                              value={line.text}
                              onChange={(e) => updateLine(idx, e.target.value)}
                              rows={1}
                              className="flex-1 bg-transparent font-sans text-sm leading-relaxed focus:outline-none resize-none border-b border-transparent focus:border-[#141414]/20 pb-1 transition-all text-right"
                              style={{ height: 'auto', minHeight: '1.5em' }}
                              onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = target.scrollHeight + 'px';
                              }}
                            />
                            <button 
                              onClick={() => removeLine(idx)}
                              className="opacity-0 group-hover:opacity-30 hover:!opacity-100 transition-opacity p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                  <div className="p-4 border-t border-[#141414]/10 flex gap-2 justify-end">
                    {script.speakers.map(speaker => (
                      <button
                        key={speaker}
                        onClick={() => addLine(speaker)}
                        className="text-[10px] font-mono uppercase tracking-wider px-3 py-1 border border-[#141414]/20 hover:border-[#141414] flex items-center gap-2 transition-all"
                      >
                        <Plus size={10} /> افزودن {speaker}
                      </button>
                    ))}
                  </div>
                </>
              )}
              
              {/* Audio Visualizer Placeholder */}
              {audioUrl && (
                <div className="h-24 border-t border-[#141414] bg-[#141414] p-4 flex items-center gap-4 overflow-hidden relative">
                  <div className="flex-1 flex items-end gap-[2px] h-full opacity-50">
                    {Array.from({ length: 100 }).map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ 
                          height: isPlaying ? [10, Math.random() * 40 + 10, 10] : 4 
                        }}
                        transition={{ 
                          duration: 0.5, 
                          repeat: Infinity, 
                          delay: i * 0.01 
                        }}
                        className="flex-1 bg-[#E4E3E0]"
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#E4E3E0] mix-blend-difference">
                      {isPlaying ? 'جریان صوتی فعال' : 'صدا برای پخش آماده است'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-none border border-[#141414] shadow-xl flex items-center gap-3 z-50 font-sans"
          >
            <span className="text-xs font-mono uppercase tracking-wider">{error}</span>
            <button onClick={() => setError(null)} className="hover:opacity-50">
              <Plus size={16} className="rotate-45" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="border-t border-[#141414] p-8 mt-12">
        <div className="max-w-6xl mx-auto flex justify-between items-center opacity-30">
          <span className="text-[10px] font-mono uppercase tracking-widest">© ۲۰۲۶ موتور پادکست‌ساز دو نفره</span>
          <div className="flex gap-8">
            <span className="text-[10px] font-mono uppercase tracking-widest">v1.1.0-stable</span>
            <span className="text-[10px] font-mono uppercase tracking-widest">تأخیر: ۲۴ میلی‌ثانیه</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
