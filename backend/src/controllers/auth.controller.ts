import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { UserRole } from '@prisma/client';

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { email, password, firstName, lastName, role } = req.body;

      // Validate role
      if (!Object.values(UserRole).includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      const result = await AuthService.register({
        email,
        password,
        firstName,
        lastName,
        role,
      });

      res.status(201).json(result);
    } catch (error: any) {
      if (error.message === 'User already exists') {
        return res.status(409).json({ message: error.message });
      }
      res.status(500).json({ message: 'Error registering user' });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login({ email, password });
      res.json(result);
    } catch (error: any) {
      if (error.message === 'Invalid credentials') {
        return res.status(401).json({ message: error.message });
      }
      res.status(500).json({ message: 'Error logging in' });
    }
  }
} 