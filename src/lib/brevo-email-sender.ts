import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys, SendSmtpEmail } from "@getbrevo/brevo";

type Recipient = { email: string; name?: string };

export type SendParams = {
  to: Recipient[];
  sender: Recipient;
  subject: string;
  htmlContent?: string;
  textContent?: string;
};

export type SendResult =
  | { success: true; messageId: string | undefined }
  | { success: false; error: string; status: number | undefined; retryCount: number };

type BrevoEmailSenderOptions = {
  maxRetries?: number;
  retryDelay?: number; // ms, multiplied by attempt number — a simple linear backoff
  logErrors?: boolean;
};

/**
 * Fast, in-request retries for transient failures (network blips, a
 * momentary 5xx from Brevo) — this is the first of two retry layers.
 * The second, slower layer is the durable EmailQueueItem-based retry in
 * src/lib/email.ts, which picks up anything that still fails after these
 * immediate attempts and retries it on the worker's next tick, surviving
 * even a server restart. Neither layer replaces the other: this one
 * handles "the network hiccuped for a second," the queue handles "Brevo
 * was actually down for ten minutes."
 */
export class BrevoEmailSender {
  private api: TransactionalEmailsApi;
  private options: Required<BrevoEmailSenderOptions>;

  constructor(apiKey: string, options: BrevoEmailSenderOptions = {}) {
    if (!apiKey) {
      throw new Error("Brevo API key is required");
    }

    this.api = new TransactionalEmailsApi();
    this.api.setApiKey(TransactionalEmailsApiApiKeys.apiKey, apiKey);

    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      logErrors: options.logErrors ?? true,
    };
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private validateParams(params: SendParams): string[] {
    const errors: string[] = [];

    if (!params.to || params.to.length === 0) {
      errors.push("Recipients (to) array is required and must not be empty");
    }
    if (!params.sender?.email) {
      errors.push("Sender email is required");
    }
    if (!params.subject) {
      errors.push("Email subject is required");
    }
    if (!params.htmlContent && !params.textContent) {
      errors.push("Either htmlContent or textContent is required");
    }
    if (params.sender?.email && !this.validateEmail(params.sender.email)) {
      errors.push(`Invalid sender email: ${params.sender.email}`);
    }
    params.to?.forEach((recipient, index) => {
      if (!this.validateEmail(recipient.email)) {
        errors.push(`Invalid recipient email at index ${index}: ${recipient.email}`);
      }
    });

    return errors;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** 5xx and network-level failures are worth an immediate retry; a 4xx (bad request, bad API key) never will succeed on retry. */
  private shouldRetry(err: unknown): boolean {
    const e = err as { status?: number; code?: string; message?: string };
    if (e?.status !== undefined && e.status >= 500 && e.status < 600) return true;
    if (e?.code === "ECONNRESET" || e?.code === "ETIMEDOUT") return true;
    if (e?.message?.includes("timeout")) return true;
    return false;
  }

  /**
   * The Brevo SDK throws an object with `.status` set directly (not
   * nested under `.response.status`) — shouldRetry() above already
   * relies on that same shape. Checked both locations anyway, since a
   * thrown network-level error (not from Brevo's API itself) may only
   * carry `.response.status` instead.
   */
  private extractStatus(err: unknown): number | undefined {
    const e = err as { status?: number; response?: { status?: number } };
    return e?.status ?? e?.response?.status;
  }

  /**
   * Brevo's own 4xx error bodies carry a real `{code, message}` (e.g.
   * "invalid_parameter: sender is not valid") that's far more useful for
   * diagnosing a real failure than the generic Error#message the SDK
   * sometimes wraps it in — pulled out here so both the retry-warning and
   * the final failure log show the actual reason Brevo rejected the send,
   * not just "Request failed with status code 401".
   */
  private extractBrevoMessage(err: unknown): string {
    const e = err as {
      message?: string;
      body?: { message?: string; code?: string };
      response?: { body?: { message?: string; code?: string } };
    };
    const body = e?.body ?? e?.response?.body;
    if (body?.message) return body.code ? `${body.code}: ${body.message}` : body.message;
    return e?.message ?? "Unknown error";
  }

  async sendEmail(params: SendParams, retryCount = 0): Promise<SendResult> {
    const validationErrors = this.validateParams(params);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(", ")}`);
    }

    const recipients = params.to.map((r) => r.email).join(",");

    try {
      const email = new SendSmtpEmail();
      email.to = params.to;
      email.sender = params.sender;
      email.subject = params.subject;
      email.htmlContent = params.htmlContent;
      email.textContent = params.textContent;

      // The actual Brevo API call.
      const result = await this.api.sendTransacEmail(email);

      if (this.options.logErrors) {
        console.log(
          `[brevo] API call succeeded — to=${recipients} subject="${params.subject}" messageId=${result.body.messageId ?? "n/a"}`
        );
      }
      return { success: true, messageId: result.body.messageId };
    } catch (err) {
      const status = this.extractStatus(err);
      const message = this.extractBrevoMessage(err);

      if (this.shouldRetry(err) && retryCount < this.options.maxRetries) {
        if (this.options.logErrors) {
          console.warn(
            `[brevo] API call failed (attempt ${retryCount + 1}/${this.options.maxRetries}) — ` +
              `to=${recipients} subject="${params.subject}" status=${status ?? "n/a"} error="${message}" — retrying...`
          );
        }
        await this.sleep(this.options.retryDelay * (retryCount + 1));
        return this.sendEmail(params, retryCount + 1);
      }

      if (this.options.logErrors) {
        console.error(
          `[brevo] API call FAILED (final) — to=${recipients} subject="${params.subject}" status=${status ?? "n/a"} error="${message}"`
        );
      }
      return { success: false, error: message, status, retryCount };
    }
  }
}
