/**
 * JWT utilities for extension authentication
 * Follows PromptOK coding patterns: 2-space indentation, proper error handling, consistent interfaces
 */
import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';

export interface ExtensionJWTPayload {
  userId: string;
  scope: string[];
  iss: string;
  aud: string;
  sub: string;
  iat: number;
  exp: number;
  jti: string;
  token_version: number;
}

export interface ExtensionJWTResult {
  jwt: string;
  expiresAt: number; // ms timestamp for convenience
  scope: string[];
  iss: string;
  aud: string;
  sub: string;
  iat: number;
  exp: number;
  jti: string;
  token_version: number;
}

export async function createExtensionJWT(userId: string, scopes: string[]): Promise<ExtensionJWTResult> {
  try {
    const secret = new TextEncoder().encode(process.env.EXTENSION_JWT_SECRET);
    
    if (!process.env.EXTENSION_JWT_SECRET) {
      throw new Error('EXTENSION_JWT_SECRET not configured');
    }

    // Use site URL for issuer with fallback to localhost for development
    // Normalize by removing any trailing slashes to avoid exact string mismatches
    const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const iss = rawSiteUrl.replace(/\/+$/, '');
    const aud = 'promptok-extension';
    const sub = userId;
    const token_version = 1;
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 10 * 60; // 10 minutes
    const jti = randomUUID();

    const payload = {
      userId,
      scope: scopes,
      iss,
      aud,
      sub,
      iat,
      exp,
      jti,
      token_version,
    };

    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(iss)
      .setAudience(aud)
      .setSubject(sub)
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(secret);

    return {
      jwt,
      expiresAt: exp * 1000,
      scope: scopes,
      iss,
      aud,
      sub,
      iat,
      exp,
      jti,
      token_version,
    };
  } catch (error) {
    console.error('[JWT Utils] Token creation failed:', error);
    throw new Error('Failed to create extension JWT');
  }
}

export async function verifyExtensionJWT(token: string): Promise<ExtensionJWTPayload> {
  try {
    const secret = new TextEncoder().encode(process.env.EXTENSION_JWT_SECRET);
    
    if (!process.env.EXTENSION_JWT_SECRET) {
      throw new Error('EXTENSION_JWT_SECRET not configured');
    }

    const { payload } = await jwtVerify(token, secret);
    
    // Validate payload structure
    if (!payload.userId || !Array.isArray(payload.scope)) {
      throw new Error('Invalid JWT payload structure');
    }

    // Validate issuer and audience - support both localhost and production
    // Normalize issuers by removing any trailing slashes to avoid exact string mismatches
    const normalize = (url?: string) => (url ? url.replace(/\/+$/, '') : url);
    const allowedIssuers = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://prompt-ok.vercel.app',
    ].map(normalize) as string[];

    // Add custom site URL if set and different from defaults
    const customSiteUrl = normalize(process.env.NEXT_PUBLIC_SITE_URL);
    if (customSiteUrl && !allowedIssuers.includes(customSiteUrl)) {
      allowedIssuers.push(customSiteUrl);
    }

    const payloadIss = normalize(payload.iss as string);
    if (!payloadIss || !allowedIssuers.includes(payloadIss)) {
      throw new Error(`Invalid issuer: expected one of [${allowedIssuers.join(', ')}], got ${payload.iss}`);
    }

    if (payload.aud !== 'promptok-extension') {
      throw new Error(`Invalid audience: expected promptok-extension, got ${payload.aud}`);
    }
    
    return payload as unknown as ExtensionJWTPayload;
  } catch (error) {
    console.error('[JWT Utils] Token verification failed:', error);
    throw new Error('Invalid or expired JWT token');
  }
}
