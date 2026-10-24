import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { message: error.message, details: error.details } });
    return;
  }
  if (error instanceof ZodError) {
    res
      .status(422)
      .json({
        error: { message: 'Confira os campos obrigatórios e os valores informados.', details: error.issues },
      });
    return;
  }
  if (error && typeof error === 'object' && 'type' in error) {
    if (error.type === 'entity.too.large') {
      res.status(413).json({ error: { message: 'O JSON ultrapassa o limite configurado.' } });
      return;
    }
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: { message: 'JSON malformado.' } });
      return;
    }
  }
  console.error(error instanceof Error ? error.message : 'Erro interno desconhecido');
  res.status(500).json({ error: { message: 'Erro interno ao processar a solicitação.' } });
};
