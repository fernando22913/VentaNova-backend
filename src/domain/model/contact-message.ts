import type { ContactStatus } from './enums.js';

/**
 * A contact submission received through the public Contact endpoint.
 *
 * There is no email delivery infrastructure, so a submission is *persisted*
 * and later read by an operator. The client is told the message was received
 * and stored — never that an email was sent. A WORKER/ADMIN can record a reply
 * from the operator inbox; that reply is stored alongside the message.
 */
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  /** Operator reply body — null until the message is answered. */
  reply: string | null;
  repliedAt: Date | null;
  /** Id of the operator (WORKER/ADMIN) who replied. */
  repliedBy: string | null;
  createdAt: Date;
}

/**
 * Boundary-validated payload used to create a message. The zod schema in the
 * route trims and bounds every field before the use case sees it.
 */
export interface ContactMessageCreateInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/** Operator reply recorded from the contact inbox. */
export interface ContactMessageReplyInput {
  reply: string;
  repliedBy: string;
}
