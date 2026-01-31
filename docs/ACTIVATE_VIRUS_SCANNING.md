# Activate Virus Scanning for File Uploads

**Priority**: CRITICAL - Security Issue
**Status**: Code ready, needs activation
**Time**: 2-3 hours

---

## Current Situation

✅ **File upload middleware exists** (`backend/src/middleware/fileUpload.ts`)
✅ **Virus scan function prepared** (lines 317-340)
✅ **VirusScanService integration ready**
❌ **NOT currently active** in upload routes

**Risk**: Files uploaded by users are NOT scanned for viruses/malware

---

## Step 1: Create Virus Scan Service (if missing)

**File**: `backend/src/services/virus-scan.service.ts`

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

export interface ScanResult {
  clean: boolean;
  virus?: string;
  method: 'clamav' | 'signature' | 'skip';
  message: string;
  scanTime: number;
}

export class VirusScanService {
  /**
   * Scan file for viruses using ClamAV (if available) or basic signature check
   */
  static async scanFile(filePath: string): Promise<ScanResult> {
    const startTime = Date.now();

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return {
          clean: false,
          method: 'skip',
          message: 'File not found',
          scanTime: Date.now() - startTime,
        };
      }

      // Try ClamAV first (if installed)
      const clamavResult = await this.scanWithClamAV(filePath);
      if (clamavResult !== null) {
        return {
          ...clamavResult,
          scanTime: Date.now() - startTime,
        };
      }

      // Fallback: Basic signature-based detection
      const signatureResult = await this.scanWithSignatures(filePath);
      return {
        ...signatureResult,
        scanTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Virus scan error:', error);

      // Fail-safe: Reject file on scan error
      return {
        clean: false,
        method: 'skip',
        message: 'Scan failed - file rejected for safety',
        scanTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Scan using ClamAV (if installed)
   */
  private static async scanWithClamAV(filePath: string): Promise<Omit<ScanResult, 'scanTime'> | null> {
    try {
      // Check if clamscan is available
      await execAsync('which clamscan');

      // Run scan
      const { stdout, stderr } = await execAsync(`clamscan --no-summary "${filePath}"`);

      if (stdout.includes('OK') && !stdout.includes('FOUND')) {
        return {
          clean: true,
          method: 'clamav',
          message: 'No threats detected',
        };
      } else if (stdout.includes('FOUND')) {
        // Extract virus name
        const virusMatch = stdout.match(/:\s+(.+?)\s+FOUND/);
        const virusName = virusMatch ? virusMatch[1] : 'Unknown';

        return {
          clean: false,
          virus: virusName,
          method: 'clamav',
          message: `Virus detected: ${virusName}`,
        };
      }

      return null; // ClamAV failed, try fallback
    } catch (error) {
      // ClamAV not installed or error
      return null;
    }
  }

  /**
   * Basic signature-based virus detection (fallback)
   */
  private static async scanWithSignatures(filePath: string): Promise<Omit<ScanResult, 'scanTime'>> {
    try {
      const buffer = Buffer.alloc(10000); // Read first 10KB
      const fd = fs.openSync(filePath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, 10000, 0);
      fs.closeSync(fd);

      const content = buffer.slice(0, bytesRead).toString('binary');

      // Known malware signatures (very basic!)
      const suspiciousPatterns = [
        /eval\(/i,                          // Eval injection
        /base64_decode/i,                   // Obfuscation
        /exec\(/i,                          // Command execution
        /system\(/i,                        // System commands
        /<script.*?src.*?http/i,           // External script loading
        /\.exe.*?MZ/,                       // Windows executable
        /X5O!P%@AP\[4\\PZX54\(P\^/,       // EICAR test virus
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          return {
            clean: false,
            virus: 'Suspicious pattern detected',
            method: 'signature',
            message: `Potentially malicious content detected`,
          };
        }
      }

      return {
        clean: true,
        method: 'signature',
        message: 'Basic scan passed',
      };
    } catch (error) {
      console.error('Signature scan error:', error);
      return {
        clean: false,
        method: 'signature',
        message: 'Scan error - file rejected',
      };
    }
  }
}
```

---

## Step 2: Add Virus Scan to Message Upload Route

**File**: `backend/src/routes/message.routes.ts`

**Change Line 8**:
```typescript
// BEFORE (current):
router.post('/', authenticate, upload.single('file'), asyncHandler(async...

// AFTER (with virus scan):
router.post('/', authenticate, upload.single('file'), virusScanMiddleware, asyncHandler(async...
```

**Add at top of file**:
```typescript
import { virusScanMiddleware } from '../middleware/fileUpload';
```

**Create the middleware** in `backend/src/middleware/fileUpload.ts`:
```typescript
/**
 * Virus scan middleware - scans uploaded files
 */
export const virusScanMiddleware = async (
  req: Request,
  res: any,
  next: any
): Promise<void> => {
  try {
    const file = req.file as Express.Multer.File;

    if (!file) {
      // No file uploaded, proceed
      return next();
    }

    console.log(`🔍 Scanning file: ${file.originalname}`);

    // Scan file for viruses
    const isClean = await virusScan(file.path);

    if (!isClean) {
      // Delete infected file
      fs.unlinkSync(file.path);

      return res.status(400).json({
        success: false,
        error: 'File rejected',
        message: 'File failed virus scan and has been rejected for security reasons',
      });
    }

    console.log(`✅ File scan passed: ${file.originalname}`);
    next();
  } catch (error) {
    console.error('❌ Virus scan middleware error:', error);

    // Delete file on error
    if (req.file) {
      const file = req.file as Express.Multer.File;
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Scan failed',
      message: 'File scan failed - file rejected for safety',
    });
  }
};
```

---

## Step 3: Install ClamAV (Optional but Recommended)

### **For Production (Ubuntu/Debian)**:
```bash
# Install ClamAV
sudo apt-get update
sudo apt-get install -y clamav clamav-daemon

# Update virus definitions
sudo freshclam

# Start ClamAV daemon
sudo systemctl start clamav-daemon
sudo systemctl enable clamav-daemon
```

### **For Development (Docker)**:
Add to `docker-compose.yml`:
```yaml
services:
  clamav:
    image: clamav/clamav:latest
    container_name: ca_clamav
    ports:
      - "3310:3310"
    volumes:
      - clamav-data:/var/lib/clamav
    networks:
      - ca-network

volumes:
  clamav-data:
```

---

## Step 4: Test Virus Scanning

### **Test File 1: Clean File**
```bash
# Upload a clean PDF
curl -X POST http://localhost:8080/api/messages \
  -H "Authorization: Bearer $TOKEN" \
  -F "receiverId=user_123" \
  -F "content=Test message" \
  -F "file=@clean_document.pdf"

# Expected: ✅ 201 Created
```

### **Test File 2: EICAR Test Virus**
```bash
# Create EICAR test virus (safe test file)
echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > eicar.txt

# Try to upload
curl -X POST http://localhost:8080/api/messages \
  -H "Authorization: Bearer $TOKEN" \
  -F "receiverId=user_123" \
  -F "content=Test virus" \
  -F "file=@eicar.txt"

# Expected: ❌ 400 Bad Request
# Response: "File failed virus scan"
```

---

## Step 5: Monitor & Log

**Add to environment variables** (`.env`):
```bash
# Virus Scanning
VIRUS_SCAN_ENABLED=true
VIRUS_SCAN_METHOD=clamav  # or 'signature'
VIRUS_SCAN_LOG_ALL=true
```

**Check logs**:
```bash
# View scan logs
docker logs ca_backend | grep "Scanning file"

# View detected viruses
docker logs ca_backend | grep "Virus detected"
```

---

## Production Deployment Checklist

- [ ] Install ClamAV on production server
- [ ] Update virus definitions (`freshclam`)
- [ ] Add `virusScanMiddleware` to all file upload routes
- [ ] Test with clean files
- [ ] Test with EICAR test virus
- [ ] Set up monitoring for scan failures
- [ ] Configure automatic virus definition updates (cron)
- [ ] Add alert for detected viruses

---

## Performance Considerations

**ClamAV Scan Times**:
- Small files (<1MB): ~100-200ms
- Medium files (1-5MB): ~200-500ms
- Large files (5-10MB): ~500ms-1s

**Recommendations**:
- Use signature-based scan for development (faster)
- Use ClamAV for production (more thorough)
- Consider async scanning for very large files
- Cache scan results for duplicate files

---

## Alternative: VirusTotal API

If ClamAV is not available, use VirusTotal API:

```typescript
// Add to VirusScanService
private static async scanWithVirusTotal(filePath: string): Promise<ScanResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;

  if (!apiKey) {
    throw new Error('VirusTotal API key not configured');
  }

  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  const response = await axios.post(
    'https://www.virustotal.com/api/v3/files',
    formData,
    {
      headers: {
        'x-apikey': apiKey,
        ...formData.getHeaders(),
      },
    }
  );

  // Poll for results
  const analysisId = response.data.data.id;
  const analysis = await this.pollVirusTotalAnalysis(analysisId, apiKey);

  return {
    clean: analysis.stats.malicious === 0,
    virus: analysis.stats.malicious > 0 ? 'Detected by multiple engines' : undefined,
    method: 'virustotal' as any,
    message: `${analysis.stats.malicious} engines detected threats`,
  };
}
```

**Pros**: Very thorough (60+ antivirus engines)
**Cons**: API rate limits (500 requests/day free tier), slower response

---

## Estimated Implementation Time

| Task | Time |
|------|------|
| Create VirusScanService | 30 min |
| Add middleware to routes | 15 min |
| Install ClamAV (optional) | 30 min |
| Testing | 45 min |
| Documentation | 15 min |
| **TOTAL** | **2-3 hours** |

---

**Priority**: COMPLETE THIS BEFORE PRODUCTION LAUNCH

**Last Updated**: 2026-01-31
