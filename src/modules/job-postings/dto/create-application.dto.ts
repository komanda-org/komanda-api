// Contrato deste endpoint: o body é VAZIO.
// - vagaId          -> vem da rota (:id)
// - profissionalId  -> vem do token (req.user.id)
//
// A classe é intencionalmente vazia: como ela não declara nenhuma
// propriedade, o ValidationPipe global (whitelist + forbidNonWhitelisted,
// ver src/main.ts) trata QUALQUER campo enviado como "não permitido" e
// responde 400. Não adicione campos aqui sem que exista uma regra de
// negócio que os justifique — a candidatura não recebe dados do cliente.
export class CreateApplicationDto {}
