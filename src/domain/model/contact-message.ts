/**
 * A contact submission received through the public Contact endpoint.
 *
 * There is no email delivery infrastructure, so a submission is *persisted*
 * and later read by an operator. The client is told the message was received
 * and stored — never that an email was sent.
 */
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
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