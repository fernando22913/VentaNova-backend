import { Router } from 'express';
import { z } from 'zod';

import type { AppContainer } from '../../../container.js';
import { parseOrThrow } from '../validation.js';
import { requireAuth } from '../middleware/require-auth.js';
import { toAuthResponse, toUserDto } from '../dto.js';

const registerSchema = z.object({
  email: z.email({ message: 'Must be a valid email address' }),
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password is too long'),
});

const loginSchema = z.object({
  email: z.email({ message: 'Must be a valid email address' }),
  password: z.string().min(1, 'Password is required').max(72),
});

/** Opaque refresh token presented by the client (raw value, never a JWT). */
const refreshTokenSchema = z.object({
  refresh_token: z.string().trim().min(1, 'Refresh token is required').max(512),
});

export function createAuthRouter(container: AppContainer): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    const input = parseOrThrow(registerSchema, req.body);
    const { user, tokens } = await container.useCases.registerUser.execute(input);
    res.status(201).json(toAuthResponse(user, tokens));
  });

  router.post('/login', async (req, res) => {
    const input = parseOrThrow(loginSchema, req.body);
    const { user, tokens } = await container.useCases.loginUser.execute(input);
    res.json(toAuthResponse(user, tokens));
  });

  router.post('/refresh', async (req, res) => {
    const input = parseOrThrow(refreshTokenSchema, req.body);
    const { user, tokens } = await container.useCases.refreshSession.execute({
      refreshToken: input.refresh_token,
    });
    res.json(toAuthResponse(user, tokens));
  });

  router.post('/logout', async (req, res) => {
    const input = parseOrThrow(refreshTokenSchema, req.body);
    await container.useCases.logout.execute({ refreshToken: input.refresh_token });
    res.status(204).send();
  });

  router.get('/me', requireAuth(container.tokenService), async (req, res) => {
    const user = await container.useCases.getMe.execute(req.auth!.userId);
    res.json({ user: toUserDto(user) });
  });

  return router;
}
