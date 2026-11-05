import { useEffect, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

export function useSukiSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('result', event => {
    const transcript = event.results?.[0]?.transcript ?? '';
    setPartial(transcript);
    if (event.isFinal && transcript.trim()) onFinal(transcript.trim());
  });
  useSpeechRecognitionEvent('error', () => setListening(false));
  useEffect(() => () => { ExpoSpeechRecognitionModule.stop(); }, []);
  const start = async () => {
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) throw new Error('Microphone permission was not granted.');
    ExpoSpeechRecognitionModule.start({ lang: 'en-IN', interimResults: true, continuous: false, requiresOnDeviceRecognition: false });
  };
  const stop = () => ExpoSpeechRecognitionModule.stop();
  return { listening, partial, start, stop };
}
