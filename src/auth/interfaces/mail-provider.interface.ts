export const MAIL_PROVIDER = 'MAIL_PROVIDER';

export interface SendPasswordRecoveryEmailParams {
  to: string;
  token: string;
}

export interface IMailProvider {
  sendPasswordRecoveryEmail(params: SendPasswordRecoveryEmailParams): Promise<void>;
}
