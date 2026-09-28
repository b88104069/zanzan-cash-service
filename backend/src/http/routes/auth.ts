import type { FastifyInstance } from 'fastify';
import type { AppDependencies } from '../app.js';

interface AuthBody {
  email: string;
  password: string;
}

/** No authentication required — this IS the authentication boundary (replaces is_user_logged_in()/get_current_user_id()). */
export function registerAuthRoutes(app: FastifyInstance, deps: AppDependencies): void {
  app.post<{ Body: AuthBody }>('/auth/register', async (request, reply) => {
    const { email, password } = request.body;
    const user = await deps.authService.register(email, password);
    const token = app.jwt.sign({ sub: user.id, role: user.role });
    reply.code(201).send({ status: 'ok', token, user: { id: user.id, email: user.email, role: user.role } });
  });

  app.post<{ Body: AuthBody }>('/auth/login', async (request, reply) => {
    const { email, password } = request.body;
    const user = await deps.authService.login(email, password);
    const token = app.jwt.sign({ sub: user.id, role: user.role });
    reply.send({ status: 'ok', token, user: { id: user.id, email: user.email, role: user.role } });
  });
}
