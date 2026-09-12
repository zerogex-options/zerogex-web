import 'server-only';

/**
 * Server-only entry point for the backend's key-administration endpoints.
 *
 * The implementation lives in core/apiKeyAdmin.ts, which is deliberately NOT
 * server-only so maintenance scripts can call revocation as well (see the
 * header there). This module keeps the `server-only` guard for every app-side
 * importer: an accidental client import still fails the build here.
 */
export * from './apiKeyAdmin.ts';
