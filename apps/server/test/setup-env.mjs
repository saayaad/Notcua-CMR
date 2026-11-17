// Keep test authentication independent from the running site's Firebase configuration.
process.env.NODE_ENV = 'test';
process.env.AUTH_MODE = 'local';
process.env.AUTOMATIC_SENDS_ENABLED = 'true';
process.env.AUTOMATIC_SENDS_TEST_DEFAULT = 'true';
process.env.API_TOKEN = '';
process.env.HOST = '127.0.0.1';
process.env.DOTENV_CONFIG_PATH = fileURLToPath(new URL('./.env.not-used', import.meta.url));
import { fileURLToPath } from 'node:url';

