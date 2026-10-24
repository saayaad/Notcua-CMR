import { SerialQueue } from '../../shared/serial-queue.js';
// A manual sequence and a triggered flow cannot claim the same conversation together.
export const automationLock = new SerialQueue();
