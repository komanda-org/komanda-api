export interface INotificacaoService {
  create(params: {
    userId: string;
    titulo: string;
    mensagem: string;
  }): void | Promise<void>;
}
