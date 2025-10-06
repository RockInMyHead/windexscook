import { ElevenLabsTTS } from '../../src/services/elevenlabs-tts.js';

// Мокаем fetch
global.fetch = jest.fn();

describe('ElevenLabsTTS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('synthesizeSpeech', () => {
    test('should synthesize speech successfully', async () => {
      const mockAudioData = Buffer.from('fake audio data');
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: jest.fn().mockResolvedValue(mockAudioData.buffer)
      };
      
      fetch.mockResolvedValue(mockResponse);
      
      const text = 'Привет, это тестовый текст';
      const voiceId = 'test-voice-id';
      
      const result = await ElevenLabsTTS.synthesizeSpeech(text, voiceId);
      
      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        `/api/elevenlabs/text-to-speech/${voiceId}`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          })
        })
      );
    });
    
    test('should handle synthesis errors', async () => {
      fetch.mockRejectedValue(new Error('TTS Error'));
      
      const text = 'Test text';
      const voiceId = 'test-voice-id';
      
      await expect(ElevenLabsTTS.synthesizeSpeech(text, voiceId))
        .rejects
        .toThrow('TTS Error');
    });
    
    test('should use default voice if not provided', async () => {
      const mockAudioData = Buffer.from('fake audio data');
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: jest.fn().mockResolvedValue(mockAudioData.buffer)
      };
      
      fetch.mockResolvedValue(mockResponse);
      
      const text = 'Test text';
      
      await ElevenLabsTTS.synthesizeSpeech(text);
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/text-to-speech/'),
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
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          voices: mockVoices
        })
      };
      
      fetch.mockResolvedValue(mockResponse);
      
      const result = await ElevenLabsTTS.getVoices();
      
      expect(result).toEqual(mockVoices);
      expect(fetch).toHaveBeenCalledWith(
        '/api/elevenlabs/voices',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
    });
    
    test('should handle get voices errors', async () => {
      fetch.mockRejectedValue(new Error('Voices Error'));
      
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
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockSettings)
      };
      
      fetch.mockResolvedValue(mockResponse);
      
      const voiceId = 'test-voice-id';
      const result = await ElevenLabsTTS.getVoiceSettings(voiceId);
      
      expect(result).toEqual(mockSettings);
      expect(fetch).toHaveBeenCalledWith(
        `/api/elevenlabs/voices/${voiceId}/settings`,
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
    });
    
    test('should handle get voice settings errors', async () => {
      fetch.mockRejectedValue(new Error('Voice Settings Error'));
      
      const voiceId = 'test-voice-id';
      
      await expect(ElevenLabsTTS.getVoiceSettings(voiceId))
        .rejects
        .toThrow('Voice Settings Error');
    });
  });
});
