import { ElevenLabsTTS } from '../../src/services/elevenlabs-tts.js';

// Мокаем axios
jest.mock('axios');
import axios from 'axios';

describe('ElevenLabsTTS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('synthesizeSpeech', () => {
    test('should synthesize speech successfully', async () => {
      const mockAudioData = Buffer.from('fake audio data');
      const mockResponse = {
        data: mockAudioData,
        headers: {
          'content-type': 'audio/mpeg'
        }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const text = 'Привет, это тестовый текст';
      const voiceId = 'test-voice-id';
      
      const result = await ElevenLabsTTS.synthesizeSpeech(text, voiceId);
      
      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining(`/text-to-speech/${voiceId}`),
        expect.objectContaining({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: expect.any(Object)
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'xi-api-key': expect.any(String),
            'Content-Type': 'application/json'
          }),
          responseType: 'arraybuffer'
        })
      );
    });
    
    test('should handle synthesis errors', async () => {
      axios.post.mockRejectedValue(new Error('TTS Error'));
      
      const text = 'Test text';
      const voiceId = 'test-voice-id';
      
      await expect(ElevenLabsTTS.synthesizeSpeech(text, voiceId))
        .rejects
        .toThrow('TTS Error');
    });
    
    test('should use default voice if not provided', async () => {
      const mockAudioData = Buffer.from('fake audio data');
      const mockResponse = {
        data: mockAudioData,
        headers: {
          'content-type': 'audio/mpeg'
        }
      };
      
      axios.post.mockResolvedValue(mockResponse);
      
      const text = 'Test text';
      
      await ElevenLabsTTS.synthesizeSpeech(text);
      
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/text-to-speech/'),
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
  
  describe('getVoices', () => {
    test('should get voices list successfully', async () => {
      const mockVoices = [
        {
          voice_id: 'voice1',
          name: 'Test Voice 1',
          category: 'premade'
        },
        {
          voice_id: 'voice2',
          name: 'Test Voice 2',
          category: 'premade'
        }
      ];
      
      const mockResponse = {
        data: {
          voices: mockVoices
        }
      };
      
      axios.get.mockResolvedValue(mockResponse);
      
      const result = await ElevenLabsTTS.getVoices();
      
      expect(result).toEqual(mockVoices);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/voices'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'xi-api-key': expect.any(String)
          })
        })
      );
    });
    
    test('should handle get voices errors', async () => {
      axios.get.mockRejectedValue(new Error('Voices Error'));
      
      await expect(ElevenLabsTTS.getVoices())
        .rejects
        .toThrow('Voices Error');
    });
  });
  
  describe('getVoiceSettings', () => {
    test('should get voice settings successfully', async () => {
      const mockSettings = {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
      };
      
      const mockResponse = {
        data: mockSettings
      };
      
      axios.get.mockResolvedValue(mockResponse);
      
      const voiceId = 'test-voice-id';
      const result = await ElevenLabsTTS.getVoiceSettings(voiceId);
      
      expect(result).toEqual(mockSettings);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/voices/${voiceId}/settings`),
        expect.objectContaining({
          headers: expect.objectContaining({
            'xi-api-key': expect.any(String)
          })
        })
      );
    });
    
    test('should handle get voice settings errors', async () => {
      axios.get.mockRejectedValue(new Error('Voice Settings Error'));
      
      const voiceId = 'test-voice-id';
      
      await expect(ElevenLabsTTS.getVoiceSettings(voiceId))
        .rejects
        .toThrow('Voice Settings Error');
    });
  });
});
