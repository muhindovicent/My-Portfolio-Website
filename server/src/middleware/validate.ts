import { z, ZodType } from 'zod.ts';
import { RequestHandler } from 'express.ts';

export function validate(schema: {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}): RequestHandler {
  return (req, res, next) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query) as Record<string, string>;
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params) as Record<string, string>;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

