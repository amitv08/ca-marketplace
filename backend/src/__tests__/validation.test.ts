import { Request } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import {
  registerValidation,
  loginValidation,
  caProfileValidation,
  createServiceRequestValidation,
  createPaymentValidation,
} from '../middleware/validation';

describe('Input Validation', () => {
  describe('registerValidation', () => {
    it('should accept valid registration data', async () => {
      const req = {
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'SecureP@ssw0rd123',
          role: 'CLIENT',
          phone: '9876543210',
        },
      } as Request;

      // Run all validations
      for (const validation of registerValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should reject name with special characters', async () => {
      const req = {
        body: {
          name: 'John@Doe',
          email: 'john@example.com',
          password: 'SecureP@ssw0rd123',
          role: 'CLIENT',
        },
      } as Request;

      for (const validation of registerValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should reject invalid email', async () => {
      const req = {
        body: {
          name: 'John Doe',
          email: 'invalid-email',
          password: 'SecureP@ssw0rd123',
          role: 'CLIENT',
        },
      } as Request;

      for (const validation of registerValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should reject short password', async () => {
      const req = {
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'Short1!',
          role: 'CLIENT',
        },
      } as Request;

      for (const validation of registerValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
      expect(errors.array().some((e) => e.msg.includes('at least 12 characters'))).toBe(true);
    });

    it('should reject invalid role', async () => {
      const req = {
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'SecureP@ssw0rd123',
          role: 'INVALID_ROLE',
        },
      } as Request;

      for (const validation of registerValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should reject invalid phone number', async () => {
      const req = {
        body: {
          name: 'John Doe',
          email: 'john@example.com',
          password: 'SecureP@ssw0rd123',
          role: 'CLIENT',
          phone: '123', // Too short
        },
      } as Request;

      for (const validation of registerValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });
  });

  describe('loginValidation', () => {
    it('should accept valid login data', async () => {
      const req = {
        body: {
          email: 'john@example.com',
          password: 'anypassword',
        },
      } as Request;

      for (const validation of loginValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should reject missing email', async () => {
      const req = {
        body: {
          password: 'password',
        },
      } as Request;

      for (const validation of loginValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should reject missing password', async () => {
      const req = {
        body: {
          email: 'john@example.com',
        },
      } as Request;

      for (const validation of loginValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });
  });

  describe('caProfileValidation', () => {
    it('should accept valid CA profile data', async () => {
      const req = {
        body: {
          caLicenseNumber: 'CA123456',
          specialization: ['GST', 'INCOME_TAX'],
          experienceYears: 5,
          hourlyRate: 1500,
          description: 'Experienced CA specializing in GST and income tax',
          qualifications: ['B.Com', 'CA'],
          languages: ['English', 'Hindi'],
        },
      } as Request;

      for (const validation of caProfileValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should reject empty specialization array', async () => {
      const req = {
        body: {
          caLicenseNumber: 'CA123456',
          specialization: [],
          experienceYears: 5,
          hourlyRate: 1500,
        },
      } as Request;

      for (const validation of caProfileValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should reject negative experience years', async () => {
      const req = {
        body: {
          caLicenseNumber: 'CA123456',
          specialization: ['GST'],
          experienceYears: -1,
          hourlyRate: 1500,
        },
      } as Request;

      for (const validation of caProfileValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should reject negative hourly rate', async () => {
      const req = {
        body: {
          caLicenseNumber: 'CA123456',
          specialization: ['GST'],
          experienceYears: 5,
          hourlyRate: -100,
        },
      } as Request;

      for (const validation of caProfileValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });
  });

  describe('createServiceRequestValidation', () => {
    it('should accept valid service request data', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const req = {
        body: {
          title: 'Need help with GST filing',
          description: 'I need assistance with filing my GST returns for the current quarter',
          serviceType: 'GST_FILING',
          budget: 5000,
          deadline: futureDate.toISOString(),
        },
      } as Request;

      for (const validation of createServiceRequestValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should reject title that is too short', async () => {
      const req = {
        body: {
          title: 'GST',
          description: 'I need assistance with filing my GST returns',
          serviceType: 'GST_FILING',
        },
      } as Request;

      for (const validation of createServiceRequestValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should reject past deadline', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const req = {
        body: {
          title: 'Need help with GST filing',
          description: 'I need assistance with filing my GST returns',
          serviceType: 'GST_FILING',
          deadline: pastDate.toISOString(),
        },
      } as Request;

      for (const validation of createServiceRequestValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should reject negative budget', async () => {
      const req = {
        body: {
          title: 'Need help with GST filing',
          description: 'I need assistance with filing my GST returns',
          serviceType: 'GST_FILING',
          budget: -1000,
        },
      } as Request;

      for (const validation of createServiceRequestValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });
  });

  describe('createPaymentValidation', () => {
    it('should accept valid payment data', async () => {
      const req = {
        body: {
          serviceRequestId: '123e4567-e89b-12d3-a456-426614174000',
          amount: 5000,
        },
      } as Request;

      for (const validation of createPaymentValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(true);
    });

    it('should reject invalid UUID', async () => {
      const req = {
        body: {
          serviceRequestId: 'invalid-uuid',
          amount: 5000,
        },
      } as Request;

      for (const validation of createPaymentValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should reject amount below minimum', async () => {
      const req = {
        body: {
          serviceRequestId: '123e4567-e89b-12d3-a456-426614174000',
          amount: 0,
        },
      } as Request;

      for (const validation of createPaymentValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });

    it('should reject amount above maximum', async () => {
      const req = {
        body: {
          serviceRequestId: '123e4567-e89b-12d3-a456-426614174000',
          amount: 99999999,
        },
      } as Request;

      for (const validation of createPaymentValidation.slice(0, -1)) {
        await (validation as ValidationChain).run(req);
      }

      const errors = validationResult(req);
      expect(errors.isEmpty()).toBe(false);
    });
  });
});
