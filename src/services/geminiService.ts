import { GoogleGenAI, Type, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ScriptLine {
  speaker: string;
  text: string;
}

export interface PodcastScript {
  speakers: string[];
  lines: ScriptLine[];
}

export interface VoiceConfig {
  speaker: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
}

export async function parseTextToScript(text: string): Promise<PodcastScript> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Parse the following text into a two-person podcast script. 
    Identify the two main speakers and break the text into a conversation between them.
    If the text is a single block, rewrite it as a natural dialogue between two hosts (e.g., Host A and Host B).
    Return the result as JSON.
    
    Text:
    ${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          speakers: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "The names of the two speakers identified or created."
          },
          lines: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                speaker: { type: Type.STRING },
                text: { type: Type.STRING }
              },
              required: ["speaker", "text"]
            }
          }
        },
        required: ["speakers", "lines"]
      }
    }
  });

  return JSON.parse(response.text || '{}') as PodcastScript;
}

export async function generatePodcastAudio(script: PodcastScript, voices: VoiceConfig[]): Promise<string> {
  // Construct the prompt for multi-speaker TTS
  const prompt = `TTS the following conversation:
  ${script.lines.map(line => `${line.speaker}: ${line.text}`).join('\n')}`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: voices.map(v => ({
            speaker: v.speaker,
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: v.voiceName }
            }
          }))
        }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Failed to generate audio data");
  }
  return base64Audio;
}

export async function generateVoiceSample(voiceName: VoiceConfig['voiceName']): Promise<string> {
  const prompt = `Say: "سلام، من ${voiceName} هستم. خوشحالم که در پادکست شما حضور دارم." in an appropriate tone.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName }
        }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Failed to generate sample audio");
  }

  return base64Audio;
}
