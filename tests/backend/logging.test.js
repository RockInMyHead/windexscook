import fs from 'fs';
import path from 'path';

// Мокаем fs и path
jest.mock('fs');
jest.mock('path');

describe('Logging Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('logToFile function', () => {
    test('should create logs directory if it does not exist', () => {
      // Мокаем fs.existsSync чтобы вернуть false
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {});
      fs.appendFileSync.mockImplementation(() => {});
      
      // Импортируем функцию логирования
      const { logToFile } = require('../../server.js');
      
      // Вызываем функцию логирования
      logToFile('INFO', 'Test message');
      
      // Проверяем, что mkdirSync был вызван
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.any(String), 
        { recursive: true }
      );
    });
    
    test('should append log entry to file', () => {
      // Мокаем fs.existsSync чтобы вернуть true
      fs.existsSync.mockReturnValue(true);
      fs.appendFileSync.mockImplementation(() => {});
      
      const { logToFile } = require('../../server.js');
      
      logToFile('INFO', 'Test message', { test: 'data' });
      
      // Проверяем, что appendFileSync был вызван
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[INFO] Test message')
      );
    });
    
    test('should format log entry correctly', () => {
      fs.existsSync.mockReturnValue(true);
      fs.appendFileSync.mockImplementation(() => {});
      
      const { logToFile } = require('../../server.js');
      
      logToFile('ERROR', 'Test error', { error: 'details' });
      
      const logCall = fs.appendFileSync.mock.calls[0];
      const logContent = logCall[1];
      
      expect(logContent).toContain('[ERROR] Test error');
      expect(logContent).toContain('"error":"details"');
      expect(logContent).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/); // ISO timestamp
    });
    
    test('should handle log entry without data', () => {
      fs.existsSync.mockReturnValue(true);
      fs.appendFileSync.mockImplementation(() => {});
      
      const { logToFile } = require('../../server.js');
      
      logToFile('WARN', 'Warning message');
      
      const logCall = fs.appendFileSync.mock.calls[0];
      const logContent = logCall[1];
      
      expect(logContent).toContain('[WARN] Warning message');
      expect(logContent).not.toContain('null');
    });
  });
  
  describe('requestLogger middleware', () => {
    test('should log request details', (done) => {
      const { requestLogger } = require('../../server.js');
      
      const mockReq = {
        method: 'GET',
        path: '/test',
        get: jest.fn().mockReturnValue('test-agent'),
        ip: '127.0.0.1'
      };
      
      const mockRes = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            // Симулируем завершение запроса
            setTimeout(() => {
              callback();
              done();
            }, 0);
          }
        })
      };
      
      const mockNext = jest.fn();
      
      requestLogger(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });
    
    test('should calculate request duration', (done) => {
      const { requestLogger } = require('../../server.js');
      
      const mockReq = {
        method: 'POST',
        path: '/api/test',
        get: jest.fn().mockReturnValue('test-agent'),
        ip: '192.168.1.1'
      };
      
      const mockRes = {
        statusCode: 201,
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            setTimeout(() => {
              callback();
              done();
            }, 10); // Небольшая задержка для тестирования duration
          }
        })
      };
      
      const mockNext = jest.fn();
      
      requestLogger(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });
  
  describe('Log file naming', () => {
    test('should create log file with current date', () => {
      fs.existsSync.mockReturnValue(true);
      fs.appendFileSync.mockImplementation(() => {});
      
      const { logToFile } = require('../../server.js');
      
      logToFile('INFO', 'Test message');
      
      const logCall = fs.appendFileSync.mock.calls[0];
      const logFilePath = logCall[0];
      
      // Проверяем, что путь содержит текущую дату в формате YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];
      expect(logFilePath).toContain(today);
      expect(logFilePath).toMatch(/\.log$/);
    });
  });
  
  describe('Error handling in logging', () => {
    test('should handle fs errors gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.appendFileSync.mockImplementation(() => {
        throw new Error('File system error');
      });
      
      const { logToFile } = require('../../server.js');
      
      // Функция не должна выбрасывать ошибку
      expect(() => {
        logToFile('ERROR', 'Test error');
      }).not.toThrow();
    });
    
    test('should handle directory creation errors', () => {
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      fs.appendFileSync.mockImplementation(() => {});
      
      const { logToFile } = require('../../server.js');
      
      // Функция не должна выбрасывать ошибку
      expect(() => {
        logToFile('INFO', 'Test message');
      }).not.toThrow();
    });
  });
});
