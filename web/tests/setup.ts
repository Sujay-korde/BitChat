import '@testing-library/jest-dom';
import { webcrypto } from 'node:crypto';

Object.defineProperty(window, 'crypto', {
  value: webcrypto,
  writable: true,
});
