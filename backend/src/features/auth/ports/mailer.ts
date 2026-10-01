export interface PasswordResetMessage {
  readonly email: string;
  readonly resetUrl: string;
}

export interface Mailer {
  sendPasswordResetLink(message: PasswordResetMessage): Promise<void>;
}

/** Development delivery: logs the reset URL to the server console (FDS REQ-AUTH-05). */
export class ConsoleMailer implements Mailer {
  async sendPasswordResetLink(message: PasswordResetMessage): Promise<void> {
    console.log(`[ConsoleMailer] Password reset link for ${message.email}: ${message.resetUrl}`);
  }
}
