/**
 * Virus Scanning Service
 * Integrates with ClamAV for malware detection in uploaded files
 */

import { LoggerService } from './logger.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream, statSync } from 'fs';
import { env } from '../config';
import net from 'net';

const execAsync = promisify(exec);

export interface ScanResult {
  clean: boolean;
  virus?: string;
  scanTime: number;
  fileSize: number;
  method: 'clamav-socket' | 'clamav-cli' | 'pattern-matching' | 'disabled';
  message: string;
}

export class VirusScanService {
  private static isAvailable: boolean | null = null;
  private static clamavHost = env.CLAMAV_HOST || 'localhost';
  private static clamavPort = parseInt(env.CLAMAV_PORT || '3310');
  private static maxFileSize = parseInt(env.MAX_SCAN_FILE_SIZE || '104857600'); // 100MB default

  /**
   * Scan a file for viruses
   * @param filePath - Absolute path to file
   * @returns Scan result with virus detection info
   */
  static async scanFile(filePath: string): Promise<ScanResult> {
    const startTime = Date.now();

    try {
      // Get file size
      const stats = statSync(filePath);
      const fileSize = stats.size;

      // Check file size limit
      if (fileSize > this.maxFileSize) {
        LoggerService.warn('File exceeds maximum scan size', {
          filePath,
          fileSize,
          maxSize: this.maxFileSize,
        });

        return {
          clean: false,
          virus: 'FILE_TOO_LARGE',
          scanTime: Date.now() - startTime,
          fileSize,
          method: 'disabled',
          message: `File size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum scan size (${(this.maxFileSize / 1024 / 1024).toFixed(2)}MB)`,
        };
      }

      // Try ClamAV socket connection first (fastest)
      if (env.CLAMAV_ENABLED === 'true') {
        try {
          const socketResult = await this.scanViaSocket(filePath, fileSize, startTime);
          return socketResult;
        } catch (socketError) {
          LoggerService.warn('ClamAV socket scan failed, trying CLI', socketError as Error);

          // Fallback to CLI
          try {
            const cliResult = await this.scanViaCLI(filePath, fileSize, startTime);
            return cliResult;
          } catch (cliError) {
            LoggerService.warn('ClamAV CLI scan failed, using pattern matching', cliError as Error);
          }
        }
      }

      // Fallback to pattern matching (basic detection)
      const patternResult = await this.scanViaPatternMatching(filePath, fileSize, startTime);
      return patternResult;
    } catch (error) {
      LoggerService.error('Virus scan failed completely', error as Error, { filePath });

      return {
        clean: false,
        virus: 'SCAN_ERROR',
        scanTime: Date.now() - startTime,
        fileSize: 0,
        method: 'disabled',
        message: `Scan error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Scan via ClamAV socket (fastest method)
   */
  private static async scanViaSocket(
    filePath: string,
    fileSize: number,
    startTime: number
  ): Promise<ScanResult> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.clamavPort, this.clamavHost);
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('ClamAV socket timeout'));
      }, 30000); // 30 second timeout

      socket.on('connect', () => {
        // Send INSTREAM command
        socket.write('zINSTREAM\0');

        // Stream file to ClamAV
        const fileStream = createReadStream(filePath);
        let chunks = 0;

        fileStream.on('data', (chunk: Buffer) => {
          // Send chunk size (4 bytes) + chunk data
          const sizeBuffer = Buffer.allocUnsafe(4);
          sizeBuffer.writeUInt32BE(chunk.length, 0);
          socket.write(sizeBuffer);
          socket.write(chunk);
          chunks++;
        });

        fileStream.on('end', () => {
          // Send zero-length chunk to signal end
          const endBuffer = Buffer.allocUnsafe(4);
          endBuffer.writeUInt32BE(0, 0);
          socket.write(endBuffer);

          LoggerService.debug('File streamed to ClamAV', { filePath, chunks });
        });

        fileStream.on('error', (error) => {
          clearTimeout(timeout);
          socket.destroy();
          reject(error);
        });
      });

      socket.on('data', (data: Buffer) => {
        clearTimeout(timeout);
        const response = data.toString().trim();

        LoggerService.debug('ClamAV response', { response, filePath });

        if (response.includes('OK')) {
          resolve({
            clean: true,
            scanTime: Date.now() - startTime,
            fileSize,
            method: 'clamav-socket',
            message: 'File is clean',
          });
        } else if (response.includes('FOUND')) {
          const virusMatch = response.match(/stream: (.+) FOUND/);
          const virusName = virusMatch ? virusMatch[1] : 'UNKNOWN_VIRUS';

          resolve({
            clean: false,
            virus: virusName,
            scanTime: Date.now() - startTime,
            fileSize,
            method: 'clamav-socket',
            message: `Virus detected: ${virusName}`,
          });
        } else {
          reject(new Error(`Unexpected ClamAV response: ${response}`));
        }

        socket.end();
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Scan via ClamAV CLI (fallback method)
   */
  private static async scanViaCLI(
    filePath: string,
    fileSize: number,
    startTime: number
  ): Promise<ScanResult> {
    try {
      const { stdout, stderr } = await execAsync(`clamscan --no-summary "${filePath}"`);

      const output = stdout + stderr;

      if (output.includes('OK')) {
        return {
          clean: true,
          scanTime: Date.now() - startTime,
          fileSize,
          method: 'clamav-cli',
          message: 'File is clean',
        };
      } else if (output.includes('FOUND')) {
        const virusMatch = output.match(/: (.+) FOUND/);
        const virusName = virusMatch ? virusMatch[1] : 'UNKNOWN_VIRUS';

        return {
          clean: false,
          virus: virusName,
          scanTime: Date.now() - startTime,
          fileSize,
          method: 'clamav-cli',
          message: `Virus detected: ${virusName}`,
        };
      } else {
        throw new Error(`Unexpected clamscan output: ${output}`);
      }
    } catch (error: any) {
      // ClamAV CLI returns exit code 1 if virus found
      if (error.code === 1 && error.stdout?.includes('FOUND')) {
        const virusMatch = error.stdout.match(/: (.+) FOUND/);
        const virusName = virusMatch ? virusMatch[1] : 'UNKNOWN_VIRUS';

        return {
          clean: false,
          virus: virusName,
          scanTime: Date.now() - startTime,
          fileSize,
          method: 'clamav-cli',
          message: `Virus detected: ${virusName}`,
        };
      }

      throw error;
    }
  }

  /**
   * Basic pattern matching scan (fallback when ClamAV unavailable)
   * This is NOT a replacement for real antivirus but provides basic protection
   */
  private static async scanViaPatternMatching(
    filePath: string,
    fileSize: number,
    startTime: number
  ): Promise<ScanResult> {
    try {
      // Read file content (up to 10MB for pattern matching)
      const readSize = Math.min(fileSize, 10 * 1024 * 1024);
      const buffer = Buffer.alloc(readSize);

      const fd = require('fs').openSync(filePath, 'r');
      require('fs').readSync(fd, buffer, 0, readSize, 0);
      require('fs').closeSync(fd);

      // Check for malicious patterns
      const content = buffer.toString('binary');

      // 1. Check for executable signatures
      if (content.startsWith('MZ')) {
        // Windows executable
        return {
          clean: false,
          virus: 'SUSPICIOUS_EXECUTABLE',
          scanTime: Date.now() - startTime,
          fileSize,
          method: 'pattern-matching',
          message: 'File appears to be a Windows executable (.exe)',
        };
      }

      if (content.startsWith('\x7FELF')) {
        // Linux/Unix executable
        return {
          clean: false,
          virus: 'SUSPICIOUS_EXECUTABLE',
          scanTime: Date.now() - startTime,
          fileSize,
          method: 'pattern-matching',
          message: 'File appears to be a Linux/Unix executable (ELF)',
        };
      }

      // 2. Check for script patterns
      const suspiciousPatterns = [
        /eval\s*\(/gi,                    // eval() function (code injection)
        /exec\s*\(/gi,                    // exec() function
        /<\?php/gi,                       // PHP code
        /<%[^>]*%>/gi,                    // JSP/ASP code
        /\$_(GET|POST|REQUEST|COOKIE)/gi, // PHP superglobals
        /base64_decode/gi,                // Base64 decoding (obfuscation)
        /shell_exec/gi,                   // Shell execution
        /system\s*\(/gi,                  // System calls
        /passthru/gi,                     // Command execution
        /proc_open/gi,                    // Process execution
        /popen/gi,                        // Pipe open
        /curl_exec/gi,                    // External requests
        /fsockopen/gi,                    // Socket connections
        /\$_FILES/gi,                     // File upload handling in PHP
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          return {
            clean: false,
            virus: 'SUSPICIOUS_PATTERN',
            scanTime: Date.now() - startTime,
            fileSize,
            method: 'pattern-matching',
            message: `Suspicious pattern detected: ${pattern.source}`,
          };
        }
      }

      // 3. Check for null bytes (potential exploit)
      if (content.includes('\0')) {
        const nullByteCount = (content.match(/\0/g) || []).length;
        // Some binary files naturally have null bytes, but many is suspicious
        if (nullByteCount > 10) {
          LoggerService.warn('Multiple null bytes detected in file', {
            filePath,
            nullByteCount,
          });
        }
      }

      // File appears clean based on pattern matching
      LoggerService.warn('File scanned with pattern matching only (ClamAV unavailable)', {
        filePath,
        fileSize,
      });

      return {
        clean: true,
        scanTime: Date.now() - startTime,
        fileSize,
        method: 'pattern-matching',
        message: 'File passed basic pattern checks (ClamAV unavailable)',
      };
    } catch (error) {
      throw new Error(`Pattern matching scan failed: ${(error as Error).message}`);
    }
  }

  /**
   * Check if ClamAV is available and responding
   */
  static async checkAvailability(): Promise<boolean> {
    if (env.CLAMAV_ENABLED !== 'true') {
      this.isAvailable = false;
      return false;
    }

    try {
      // Try to connect to ClamAV socket
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection(this.clamavPort, this.clamavHost);
        const timeout = setTimeout(() => {
          socket.destroy();
          reject(new Error('Connection timeout'));
        }, 5000);

        socket.on('connect', () => {
          clearTimeout(timeout);
          socket.write('zPING\0');
        });

        socket.on('data', (data: Buffer) => {
          clearTimeout(timeout);
          const response = data.toString().trim();
          socket.end();

          if (response === 'PONG') {
            resolve();
          } else {
            reject(new Error(`Unexpected response: ${response}`));
          }
        });

        socket.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.isAvailable = true;
      LoggerService.info('ClamAV is available and responding');
      return true;
    } catch (error) {
      this.isAvailable = false;
      LoggerService.warn('ClamAV is not available', error as Error);
      return false;
    }
  }

  /**
   * Get ClamAV version and signature database info
   */
  static async getVersion(): Promise<{
    version: string;
    signatures: number;
    lastUpdate: Date | null;
  }> {
    try {
      const { stdout } = await execAsync('clamdscan --version');
      const versionMatch = stdout.match(/ClamAV (\d+\.\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      // Try to get signature count
      let signatures = 0;
      let lastUpdate = null;

      try {
        const { stdout: dbStats } = await execAsync('clamdscan --version');
        const sigMatch = dbStats.match(/(\d+) signatures/);
        if (sigMatch) {
          signatures = parseInt(sigMatch[1]);
        }
      } catch (error) {
        LoggerService.debug('Could not get signature count', error as Error);
      }

      return { version, signatures, lastUpdate };
    } catch (error) {
      LoggerService.error('Failed to get ClamAV version', error as Error);
      return { version: 'unknown', signatures: 0, lastUpdate: null };
    }
  }

  /**
   * Scan multiple files in batch
   */
  static async scanFiles(filePaths: string[]): Promise<ScanResult[]> {
    const results = await Promise.all(
      filePaths.map(async (filePath) => {
        try {
          return await this.scanFile(filePath);
        } catch (error) {
          LoggerService.error('Batch scan failed for file', error as Error, { filePath });
          return {
            clean: false,
            virus: 'SCAN_ERROR',
            scanTime: 0,
            fileSize: 0,
            method: 'disabled' as const,
            message: `Scan error: ${(error as Error).message}`,
          };
        }
      })
    );

    return results;
  }

  /**
   * Get scanning statistics
   */
  static getStats(): {
    isAvailable: boolean | null;
    clamavHost: string;
    clamavPort: number;
    maxFileSize: number;
  } {
    return {
      isAvailable: this.isAvailable,
      clamavHost: this.clamavHost,
      clamavPort: this.clamavPort,
      maxFileSize: this.maxFileSize,
    };
  }
}

export default VirusScanService;
