export interface INotificacaoService {
  create(params: {
    userId: string;
    title: string;
    message: string;
  }): void | Promise<void>;
}
